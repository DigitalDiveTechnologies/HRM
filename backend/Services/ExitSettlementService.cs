using System.Data.Common;
using System.Globalization;
using System.Text.Json;
using DigitalDive.Hr.Api.Data;
using Npgsql;

namespace DigitalDive.Hr.Api.Services;

/// <summary>Phase 2 exit settlement — EOSB via rule versions + leave/notice placeholders.</summary>
public sealed class ExitSettlementService
{
    private readonly Db _db;
    private readonly EosbCalculatorService _eosb;

    public ExitSettlementService(Db db, EosbCalculatorService eosb)
    {
        _db = db;
        _eosb = eosb;
    }

    private async Task<NpgsqlConnection> OpenAsync(CancellationToken ct)
    {
        var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        return conn;
    }

    private static Dictionary<string, object?> Row(DbDataReader reader)
    {
        var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < reader.FieldCount; i++)
            dict[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
        return dict;
    }

    private static async Task<Dictionary<string, object?>?> ReadOneAsync(NpgsqlCommand cmd, CancellationToken ct)
    {
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return Row(reader);
    }

    public async Task<(object? Result, string? Error)> CalculateForExitCaseAsync(
        int exitCaseId, string? actorEmail, decimal unusedLeaveDays, decimal noticePayDays,
        decimal otherEarnings, decimal otherDeductions, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);

        await using var find = new NpgsqlCommand(
            """
            SELECT x.id, x.employee_id, x.last_working_date, x.exit_type,
                   e.basic_salary, e.allowances, e.join_date, e.full_name, e.emp_code
            FROM exit_cases x
            JOIN employees e ON e.id = x.employee_id
            WHERE x.id = @id
            """, conn);
        find.Parameters.AddWithValue("id", exitCaseId);
        var row = await ReadOneAsync(find, ct);
        if (row is null) return (null, "Exit case not found");

        var employeeId = Convert.ToInt32(row["employee_id"]);
        var basic = row["basic_salary"] is decimal b ? b : Convert.ToDecimal(row["basic_salary"] ?? 0m);
        DateTime? join = row["join_date"] as DateTime?;
        var lwd = row["last_working_date"] as DateTime? ?? DateTime.UtcNow.Date;
        var years = join is null ? 0d : Math.Max(0, (lwd - join.Value).TotalDays / 365.25);

        // Lifetime approved unpaid leave days (service-year adjustment)
        decimal unpaidDays;
        await using (var u = new NpgsqlCommand(
                         """
                         SELECT COALESCE(SUM(days),0)::numeric FROM leave_requests
                         WHERE employee_id = @eid AND status = 'approved'
                           AND lower(leave_type) LIKE '%unpaid%'
                         """, conn))
        {
            u.Parameters.AddWithValue("eid", employeeId);
            unpaidDays = Convert.ToDecimal(await u.ExecuteScalarAsync(ct) ?? 0m);
        }

        var eosbObj = await _eosb.CalculatePreviewAsync(basic, years, (double)unpaidDays, "uae_mainland", ct);
        var eosbJson = JsonSerializer.Serialize(eosbObj);
        using var doc = JsonDocument.Parse(eosbJson);
        var root = doc.RootElement;
        var eosbAmount = root.TryGetProperty("eosbAmount", out var ea) ? ea.GetDecimal() : 0m;
        var ruleCode = root.TryGetProperty("ruleCode", out var rc) ? rc.GetString() : null;
        var formula = root.TryGetProperty("formulaVersion", out var fv) ? fv.GetString() : null;

        var unusedLeaveAmt = Math.Round((basic / 30m) * unusedLeaveDays, 2);
        var noticePay = Math.Round((basic / 30m) * noticePayDays, 2);
        var unpaidAbsDed = 0m; // already reflected in EOSB years; final salary unpaid handled in last payroll
        var net = eosbAmount + unusedLeaveAmt + noticePay + otherEarnings - otherDeductions - unpaidAbsDed;

        await using var upsert = new NpgsqlCommand(
            """
            INSERT INTO exit_settlements (
              exit_case_id, employee_id, eosb_amount, unused_leave_amount, notice_pay,
              other_earnings, other_deductions, unpaid_absence_deduction, net_settlement,
              service_years, unpaid_leave_days, rule_code, formula_version, jurisdiction_profile,
              breakdown_json, is_preview, calculated_by_email)
            VALUES (
              @xid, @eid, @eosb, @leave, @notice, @earn, @ded, @unpaid, @net,
              @years, @udays, @rule, @formula, 'uae_mainland', @break::jsonb, TRUE, @email)
            ON CONFLICT (exit_case_id) DO UPDATE SET
              eosb_amount = EXCLUDED.eosb_amount,
              unused_leave_amount = EXCLUDED.unused_leave_amount,
              notice_pay = EXCLUDED.notice_pay,
              other_earnings = EXCLUDED.other_earnings,
              other_deductions = EXCLUDED.other_deductions,
              unpaid_absence_deduction = EXCLUDED.unpaid_absence_deduction,
              net_settlement = EXCLUDED.net_settlement,
              service_years = EXCLUDED.service_years,
              unpaid_leave_days = EXCLUDED.unpaid_leave_days,
              rule_code = EXCLUDED.rule_code,
              formula_version = EXCLUDED.formula_version,
              breakdown_json = EXCLUDED.breakdown_json,
              calculated_at = NOW(),
              calculated_by_email = EXCLUDED.calculated_by_email
            RETURNING *
            """, conn);
        upsert.Parameters.AddWithValue("xid", exitCaseId);
        upsert.Parameters.AddWithValue("eid", employeeId);
        upsert.Parameters.AddWithValue("eosb", eosbAmount);
        upsert.Parameters.AddWithValue("leave", unusedLeaveAmt);
        upsert.Parameters.AddWithValue("notice", noticePay);
        upsert.Parameters.AddWithValue("earn", otherEarnings);
        upsert.Parameters.AddWithValue("ded", otherDeductions);
        upsert.Parameters.AddWithValue("unpaid", unpaidAbsDed);
        upsert.Parameters.AddWithValue("net", Math.Round(net, 2));
        upsert.Parameters.AddWithValue("years", Math.Round((decimal)years, 2));
        upsert.Parameters.AddWithValue("udays", unpaidDays);
        upsert.Parameters.AddWithValue("rule", (object?)ruleCode ?? DBNull.Value);
        upsert.Parameters.AddWithValue("formula", (object?)formula ?? DBNull.Value);
        upsert.Parameters.AddWithValue("break", eosbJson);
        upsert.Parameters.AddWithValue("email", (object?)actorEmail ?? DBNull.Value);
        var settlement = await ReadOneAsync(upsert, ct);

        var autoNote =
            $"Settlement PREVIEW: EOSB {eosbAmount:0.##} + leave {unusedLeaveAmt:0.##} + notice {noticePay:0.##} − ded {otherDeductions:0.##} = {net:0.##} ({ruleCode}/{formula}).";
        await using var updExit = new NpgsqlCommand(
            """
            UPDATE exit_cases
            SET eosb_amount = @eosb, service_years = @years,
                settlement_notes = CASE
                  WHEN settlement_notes IS NULL OR settlement_notes = '' THEN @note
                  WHEN settlement_notes LIKE '%Settlement PREVIEW:%' THEN settlement_notes
                  ELSE settlement_notes || ' | ' || @note
                END
            WHERE id = @id
            RETURNING *
            """, conn);
        updExit.Parameters.AddWithValue("eosb", eosbAmount);
        updExit.Parameters.AddWithValue("years", Math.Round((decimal)years, 2));
        updExit.Parameters.AddWithValue("note", autoNote);
        updExit.Parameters.AddWithValue("id", exitCaseId);
        var exitCase = await ReadOneAsync(updExit, ct);

        // Vacate primary position seat on completed settlement calc (soft — still open case)
        await using var vacate = new NpgsqlCommand(
            """
            UPDATE position_assignments
            SET end_date = COALESCE(end_date, @lwd::date), is_primary = FALSE
            WHERE employee_id = @eid AND (end_date IS NULL OR end_date > @lwd::date)
            """, conn);
        vacate.Parameters.AddWithValue("eid", employeeId);
        vacate.Parameters.AddWithValue("lwd", lwd);
        try { await vacate.ExecuteNonQueryAsync(ct); } catch { /* table may be empty/missing on old DB */ }

        return (new
        {
            isPreview = true,
            exitCase,
            settlement,
            worksheet = new
            {
                employee = Convert.ToString(row["full_name"]),
                empCode = Convert.ToString(row["emp_code"]),
                basicSalary = basic,
                serviceYears = Math.Round(years, 2),
                unpaidLeaveDays = unpaidDays,
                eosbAmount,
                unusedLeaveDays,
                unusedLeaveAmount = unusedLeaveAmt,
                noticePayDays,
                noticePay,
                otherEarnings,
                otherDeductions,
                netSettlement = Math.Round(net, 2),
                ruleCode,
                formulaVersion = formula,
            },
        }, null);
    }

    public async Task<Dictionary<string, object?>?> GetSettlementAsync(int exitCaseId, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT * FROM exit_settlements WHERE exit_case_id = @id", conn);
        cmd.Parameters.AddWithValue("id", exitCaseId);
        return await ReadOneAsync(cmd, ct);
    }
}
