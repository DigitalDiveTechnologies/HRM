using System.Data;
using System.Data.Common;
using System.Globalization;
using System.Text;
using System.Text.Json;
using DigitalDive.Hr.Api.Data;
using Npgsql;

namespace DigitalDive.Hr.Api.Services;

/// <summary>
/// Phase 2 payroll control: calculate → review → approve/lock → pay → close / reverse.
/// Payslips kept in sync for existing portal lists. Exports gated after approve.
/// </summary>
public sealed class PayrollControlService
{
    private readonly Db _db;
    private readonly HrQueryService _hr;

    public PayrollControlService(Db db, HrQueryService hr)
    {
        _db = db;
        _hr = hr;
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

    private static async Task<List<Dictionary<string, object?>>> ReadAllAsync(NpgsqlCommand cmd, CancellationToken ct)
    {
        var list = new List<Dictionary<string, object?>>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            list.Add(Row(reader));
        return list;
    }

    public static bool TryParsePeriod(string periodLabel, out int year, out int month)
    {
        year = 0;
        month = 0;
        var p = periodLabel.Trim();
        if (p.Length >= 7 && DateTime.TryParseExact(p[..7], "yyyy-MM", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var dt))
        {
            year = dt.Year;
            month = dt.Month;
            return true;
        }
        return false;
    }

    public async Task<List<Dictionary<string, object?>>> ListRunsAsync(CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            SELECT r.*,
                   (SELECT COUNT(*)::int FROM payroll_run_lines l WHERE l.payroll_run_id = r.id) AS line_count,
                   (SELECT COALESCE(SUM(l.net),0) FROM payroll_run_lines l WHERE l.payroll_run_id = r.id) AS total_net,
                   (SELECT COUNT(*)::int FROM payroll_run_lines l WHERE l.payroll_run_id = r.id AND NOT l.wps_ready) AS not_ready_count
            FROM payroll_runs r
            ORDER BY r.period_year DESC, r.period_month DESC, r.id DESC
            LIMIT 100
            """, conn);
        return await ReadAllAsync(cmd, ct);
    }

    public async Task<Dictionary<string, object?>?> GetRunAsync(int runId, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT * FROM payroll_runs WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", runId);
        return await ReadOneAsync(cmd, ct);
    }

    public async Task<List<Dictionary<string, object?>>> GetLinesAsync(int runId, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            SELECT l.*, e.emp_code AS emp_code_live, e.full_name AS full_name_live
            FROM payroll_run_lines l
            JOIN employees e ON e.id = l.employee_id
            WHERE l.payroll_run_id = @id
            ORDER BY COALESCE(l.emp_code, e.emp_code)
            """, conn);
        cmd.Parameters.AddWithValue("id", runId);
        return await ReadAllAsync(cmd, ct);
    }

    public async Task<(object? Result, string? Error)> CalculateAsync(
        string periodLabel, decimal otRatePerHour, int? legalEntityId, string? actorEmail, CancellationToken ct)
    {
        if (!TryParsePeriod(periodLabel, out var year, out var month))
            return (null, "periodLabel required as YYYY-MM");

        var rate = otRatePerHour <= 0 ? 50m : otRatePerHour;
        var periodKey = $"{year:D4}-{month:D2}";
        var periodStart = new DateTime(year, month, 1);
        var periodEnd = periodStart.AddMonths(1).AddDays(-1);

        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        int runId;
        string status;
        await using (var find = new NpgsqlCommand(
                         """
                         SELECT id, status FROM payroll_runs
                         WHERE period_year = @y AND period_month = @m
                           AND COALESCE(legal_entity_id, 0) = COALESCE(@leid::int, 0)
                           AND status NOT IN ('reversed')
                         ORDER BY id DESC LIMIT 1
                         """, conn, (NpgsqlTransaction)tx))
        {
            find.Parameters.AddWithValue("y", year);
            find.Parameters.AddWithValue("m", month);
            find.Parameters.AddWithValue("leid", (object?)legalEntityId ?? DBNull.Value);
            await using var fr = await find.ExecuteReaderAsync(ct);
            if (await fr.ReadAsync(ct))
            {
                runId = fr.GetInt32(0);
                status = fr.GetString(1);
            }
            else
            {
                runId = 0;
                status = "";
            }
        }

        if (runId > 0 && status is "approved" or "paid" or "closed" or "reviewed")
            return (null, $"Run #{runId} is '{status}' — reverse or unlock flow required before recalculate.");

        if (runId == 0)
        {
            await using var ins = new NpgsqlCommand(
                """
                INSERT INTO payroll_runs (period_year, period_month, legal_entity_id, status, label, is_preview, created_by_email)
                VALUES (@y, @m, @leid, 'draft', @label, TRUE, @email)
                RETURNING id
                """, conn, (NpgsqlTransaction)tx);
            ins.Parameters.AddWithValue("y", year);
            ins.Parameters.AddWithValue("m", month);
            ins.Parameters.AddWithValue("leid", (object?)legalEntityId ?? DBNull.Value);
            ins.Parameters.AddWithValue("label", periodKey);
            ins.Parameters.AddWithValue("email", (object?)actorEmail ?? DBNull.Value);
            runId = Convert.ToInt32(await ins.ExecuteScalarAsync(ct));
            await AddEventAsync(conn, (NpgsqlTransaction)tx, runId, null, "draft", actorEmail, null, "created", ct);
        }

        await using (var del = new NpgsqlCommand(
                         "DELETE FROM payroll_run_lines WHERE payroll_run_id = @id", conn, (NpgsqlTransaction)tx))
        {
            del.Parameters.AddWithValue("id", runId);
            await del.ExecuteNonQueryAsync(ct);
        }

        var emps = new List<(int Id, string Code, string Name, decimal Basic, decimal Allow, string PayrollType,
            string? Iban, string? Mol, bool IsEmirati, string? PensionAuth, decimal? PensionBase)>();
        await using (var empCmd = new NpgsqlCommand(
                         """
                         SELECT e.id, e.emp_code, e.full_name, e.basic_salary, e.allowances,
                                COALESCE(dv.payroll_type, 'wps') AS payroll_type,
                                e.master_data->>'iban' AS iban,
                                COALESCE(e.master_data->>'molId', e.master_data->>'mol_id') AS mol_id,
                                COALESCE(e.is_emirati, FALSE) AS is_emirati,
                                e.pension_authority,
                                e.pension_contribution_salary
                         FROM employees e
                         LEFT JOIN divisions dv ON dv.id = e.division_id
                         WHERE e.in_hr_ops = TRUE AND e.status = 'active'
                         """, conn, (NpgsqlTransaction)tx))
        await using (var er = await empCmd.ExecuteReaderAsync(ct))
        {
            while (await er.ReadAsync(ct))
            {
                emps.Add((
                    er.GetInt32(0),
                    er.IsDBNull(1) ? "" : er.GetString(1),
                    er.IsDBNull(2) ? "" : er.GetString(2),
                    er.IsDBNull(3) ? 0m : er.GetDecimal(3),
                    er.IsDBNull(4) ? 0m : er.GetDecimal(4),
                    er.IsDBNull(5) ? "wps" : er.GetString(5),
                    er.IsDBNull(6) ? null : er.GetString(6),
                    er.IsDBNull(7) ? null : er.GetString(7),
                    !er.IsDBNull(8) && er.GetBoolean(8),
                    er.IsDBNull(9) ? null : er.GetString(9),
                    er.IsDBNull(10) ? null : er.GetDecimal(10)));
            }
        }

        var createdSlips = 0;
        var wpsCount = 0;
        var bankCount = 0;
        var stamp = DateTime.UtcNow.ToString("yyyyMMddHHmm");
        var wpsBatch = $"WPS-{periodKey}-{stamp}";
        var bankBatch = $"BT-{periodKey}-{stamp}";

        foreach (var emp in emps)
        {
            decimal otHours;
            await using (var otCmd = new NpgsqlCommand(
                             """
                             SELECT COALESCE(SUM(overtime_hours),0)::numeric FROM attendance
                             WHERE employee_id = @eid AND work_date >= @ps::date AND work_date <= @pe::date
                             """, conn, (NpgsqlTransaction)tx))
            {
                otCmd.Parameters.AddWithValue("eid", emp.Id);
                otCmd.Parameters.AddWithValue("ps", periodStart);
                otCmd.Parameters.AddWithValue("pe", periodEnd);
                otHours = Convert.ToDecimal(await otCmd.ExecuteScalarAsync(ct) ?? 0m);
            }
            var otPay = Math.Round(otHours * rate, 2);

            decimal unpaidDays;
            await using (var unpaidCmd = new NpgsqlCommand(
                             """
                             SELECT COALESCE(SUM(
                               GREATEST(0,
                                 (LEAST(end_date, @pe::date) - GREATEST(start_date, @ps::date)) + 1
                               )
                             ), 0)::numeric
                             FROM leave_requests
                             WHERE employee_id = @eid
                               AND status = 'approved'
                               AND lower(leave_type) LIKE '%unpaid%'
                               AND start_date <= @pe::date
                               AND end_date >= @ps::date
                             """, conn, (NpgsqlTransaction)tx))
            {
                unpaidCmd.Parameters.AddWithValue("eid", emp.Id);
                unpaidCmd.Parameters.AddWithValue("ps", periodStart);
                unpaidCmd.Parameters.AddWithValue("pe", periodEnd);
                unpaidDays = Convert.ToDecimal(await unpaidCmd.ExecuteScalarAsync(ct) ?? 0m);
            }
            var unpaidDeduction = emp.Basic > 0 && unpaidDays > 0
                ? Math.Round((emp.Basic / 30m) * unpaidDays, 2)
                : 0m;

            // GPSSA preview: UAE nationals ~5% employee / 12.5% employer on contribution salary (placeholder rates)
            var gpssaEmp = 0m;
            var gpssaEr = 0m;
            var auth = (emp.PensionAuth ?? "").Trim().ToLowerInvariant();
            if (emp.IsEmirati || auth is "gpssa" or "uae")
            {
                var basePay = emp.PensionBase is > 0 ? emp.PensionBase.Value : emp.Basic;
                gpssaEmp = Math.Round(basePay * 0.05m, 2);
                gpssaEr = Math.Round(basePay * 0.125m, 2);
            }

            var otherDed = gpssaEmp;
            var gross = emp.Basic + emp.Allow + otPay;
            var net = gross - unpaidDeduction - otherDed;
            var isBank = string.Equals(emp.PayrollType, "bank_transfer", StringComparison.OrdinalIgnoreCase);
            var paymentMethod = isBank ? "bank_transfer" : "wps";
            if (isBank) bankCount++; else wpsCount++;

            var notes = new List<string>();
            if (string.IsNullOrWhiteSpace(emp.Iban)) notes.Add("missing IBAN");
            if (!isBank && string.IsNullOrWhiteSpace(emp.Mol)) notes.Add("missing MOL ID");
            if (net < 0) notes.Add("negative net");

            await using (var line = new NpgsqlCommand(
                             """
                             INSERT INTO payroll_run_lines (
                               payroll_run_id, employee_id, basic_salary, allowances, overtime_amount,
                               unpaid_leave_deduction, other_deductions, gross, net, iban, mol_id,
                               payment_method, wps_ready, validation_notes, overtime_hours, unpaid_leave_days,
                               gpssa_employee, gpssa_employer, emp_code, full_name)
                             VALUES (
                               @rid, @eid, @basic, @allow, @ot, @unpaid, @other, @gross, @net, @iban, @mol,
                               @pm, @ready, @notes, @oth, @upd, @ge, @gr, @code, @name)
                             """, conn, (NpgsqlTransaction)tx))
            {
                line.Parameters.AddWithValue("rid", runId);
                line.Parameters.AddWithValue("eid", emp.Id);
                line.Parameters.AddWithValue("basic", emp.Basic);
                line.Parameters.AddWithValue("allow", emp.Allow);
                line.Parameters.AddWithValue("ot", otPay);
                line.Parameters.AddWithValue("unpaid", unpaidDeduction);
                line.Parameters.AddWithValue("other", otherDed);
                line.Parameters.AddWithValue("gross", gross);
                line.Parameters.AddWithValue("net", net);
                line.Parameters.AddWithValue("iban", (object?)emp.Iban ?? DBNull.Value);
                line.Parameters.AddWithValue("mol", (object?)emp.Mol ?? DBNull.Value);
                line.Parameters.AddWithValue("pm", paymentMethod);
                line.Parameters.AddWithValue("ready", !isBank && notes.Count == 0);
                line.Parameters.AddWithValue("notes", notes.Count == 0 ? DBNull.Value : string.Join("; ", notes));
                line.Parameters.AddWithValue("oth", otHours);
                line.Parameters.AddWithValue("upd", unpaidDays);
                line.Parameters.AddWithValue("ge", gpssaEmp);
                line.Parameters.AddWithValue("gr", gpssaEr);
                line.Parameters.AddWithValue("code", emp.Code);
                line.Parameters.AddWithValue("name", emp.Name);
                await line.ExecuteNonQueryAsync(ct);
            }

            // Keep legacy payslips in sync (replace period slip)
            await using (var delSlip = new NpgsqlCommand(
                             "DELETE FROM payslips WHERE employee_id = @eid AND period_label = @p",
                             conn, (NpgsqlTransaction)tx))
            {
                delSlip.Parameters.AddWithValue("eid", emp.Id);
                delSlip.Parameters.AddWithValue("p", periodKey);
                await delSlip.ExecuteNonQueryAsync(ct);
            }

            var batch = isBank ? bankBatch : wpsBatch;
            var prefix = isBank ? "BT" : "WPS";
            var deductions = unpaidDeduction + otherDed;
            await using (var slip = new NpgsqlCommand(
                             """
                             INSERT INTO payslips (employee_id, period_label, basic_salary, overtime_pay, allowances, deductions, net_pay, wps_ref, payment_method)
                             VALUES (@eid, @p, @basic, @ot, @allow, @ded, @net, @ref, @pm)
                             """, conn, (NpgsqlTransaction)tx))
            {
                slip.Parameters.AddWithValue("eid", emp.Id);
                slip.Parameters.AddWithValue("p", periodKey);
                slip.Parameters.AddWithValue("basic", emp.Basic);
                slip.Parameters.AddWithValue("ot", otPay);
                slip.Parameters.AddWithValue("allow", emp.Allow);
                slip.Parameters.AddWithValue("ded", deductions);
                slip.Parameters.AddWithValue("net", net);
                slip.Parameters.AddWithValue("ref", $"{prefix}-{batch}-{emp.Id}");
                slip.Parameters.AddWithValue("pm", paymentMethod);
                await slip.ExecuteNonQueryAsync(ct);
                createdSlips++;
            }
        }

        await using (var upd = new NpgsqlCommand(
                         """
                         UPDATE payroll_runs
                         SET status = 'calculated', calculated_at = NOW(), label = @label,
                             created_by_email = COALESCE(created_by_email, @email)
                         WHERE id = @id
                         RETURNING *
                         """, conn, (NpgsqlTransaction)tx))
        {
            upd.Parameters.AddWithValue("id", runId);
            upd.Parameters.AddWithValue("label", periodKey);
            upd.Parameters.AddWithValue("email", (object?)actorEmail ?? DBNull.Value);
            var run = await ReadOneAsync(upd, ct);
            await AddEventAsync(conn, (NpgsqlTransaction)tx, runId, status is "" or "draft" ? (status == "" ? null : status) : status,
                "calculated", actorEmail, null, $"lines={emps.Count}; otRate={rate}", ct);
            await tx.CommitAsync(ct);

            return (new
            {
                run,
                periodLabel = periodKey,
                created = createdSlips,
                lineCount = emps.Count,
                wpsCount,
                bankTransferCount = bankCount,
                wpsBatch,
                bankBatch,
                isPreview = true,
                previewNote = "Attendance OT + unpaid leave (period-overlap days) + GPSSA preview rates. Control states enabled.",
            }, null);
        }
    }

    public async Task<(Dictionary<string, object?>? Row, string? Error)> TransitionAsync(
        int runId, string action, string? actorEmail, string? actorRole, bool forceSelfApprove, CancellationToken ct)
    {
        var act = action.Trim().ToLowerInvariant();
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        await using var get = new NpgsqlCommand("SELECT * FROM payroll_runs WHERE id = @id FOR UPDATE", conn, (NpgsqlTransaction)tx);
        get.Parameters.AddWithValue("id", runId);
        var run = await ReadOneAsync(get, ct);
        if (run is null) return (null, "Run not found");

        var from = Convert.ToString(run["status"]) ?? "draft";
        string? to = null;
        string? extraSql = null;

        switch (act)
        {
            case "submit":
            case "review":
            {
                if (from is not ("calculated" or "draft"))
                    return (null, $"Cannot submit from '{from}'");
                to = "reviewed";
                extraSql = "submitted_at = NOW()";
                break;
            }
            case "approve":
            {
                if (from != "reviewed")
                    return (null, $"Cannot approve from '{from}' — submit for review first");
                var maker = Convert.ToString(run["created_by_email"]);
                if (!forceSelfApprove
                    && !string.IsNullOrWhiteSpace(maker)
                    && !string.IsNullOrWhiteSpace(actorEmail)
                    && string.Equals(maker, actorEmail, StringComparison.OrdinalIgnoreCase))
                {
                    return (null, "Maker-checker: same user cannot approve own payroll run. Use forceSelfApprove only in preview, or a different approver.");
                }

                await using (var val = new NpgsqlCommand(
                                 """
                                 SELECT COUNT(*)::int FROM payroll_run_lines
                                 WHERE payroll_run_id = @id AND (
                                   net < 0
                                   OR (@strict AND payment_method = 'wps' AND NOT wps_ready)
                                 )
                                 """, conn, (NpgsqlTransaction)tx))
                {
                    val.Parameters.AddWithValue("id", runId);
                    val.Parameters.AddWithValue("strict", !forceSelfApprove);
                    var bad = Convert.ToInt32(await val.ExecuteScalarAsync(ct));
                    if (bad > 0)
                        return (null, $"{bad} line(s) fail validation (negative net or WPS not ready). Fix data, or use forceSelfApprove in preview.");
                }

                to = "approved";
                extraSql = "approved_at = NOW(), locked_at = NOW(), approved_by_email = @approver";
                break;
            }
            case "pay":
            {
                if (from != "approved")
                    return (null, $"Cannot mark paid from '{from}'");
                to = "paid";
                extraSql = "paid_at = NOW()";
                break;
            }
            case "close":
            {
                if (from is not ("paid" or "approved"))
                    return (null, $"Cannot close from '{from}'");
                to = "closed";
                break;
            }
            case "reject":
            {
                if (from is not ("reviewed" or "calculated"))
                    return (null, $"Cannot reject from '{from}'");
                to = "draft";
                break;
            }
            default:
                return (null, "Unknown action. Use submit|approve|pay|close|reject|reverse");
        }

        await using var upd = new NpgsqlCommand(
            $"""
             UPDATE payroll_runs
             SET status = @to{(extraSql is null ? "" : ", " + extraSql)}
             WHERE id = @id
             RETURNING *
             """, conn, (NpgsqlTransaction)tx);
        upd.Parameters.AddWithValue("to", to!);
        upd.Parameters.AddWithValue("id", runId);
        upd.Parameters.AddWithValue("approver", (object?)actorEmail ?? DBNull.Value);
        var updated = await ReadOneAsync(upd, ct);
        await AddEventAsync(conn, (NpgsqlTransaction)tx, runId, from, to!, actorEmail, actorRole, act, ct);
        await tx.CommitAsync(ct);

        await _hr.WriteAuditAsync(actorEmail, actorRole, "payroll_" + act, "payroll_run", runId,
            $"{from}->{to}", ct);
        return (updated, null);
    }

    public async Task<(object? Result, string? Error)> ReverseAsync(
        int runId, string? actorEmail, string? actorRole, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        await using var get = new NpgsqlCommand("SELECT * FROM payroll_runs WHERE id = @id FOR UPDATE", conn, (NpgsqlTransaction)tx);
        get.Parameters.AddWithValue("id", runId);
        var run = await ReadOneAsync(get, ct);
        if (run is null) return (null, "Run not found");

        var from = Convert.ToString(run["status"]) ?? "";
        if (from is not ("approved" or "paid" or "closed"))
            return (null, $"Can only reverse approved/paid/closed runs (current: {from})");

        var year = Convert.ToInt32(run["period_year"]);
        var month = Convert.ToInt32(run["period_month"]);
        var leid = run["legal_entity_id"];
        var periodKey = $"{year:D4}-{month:D2}";

        await using (var mark = new NpgsqlCommand(
                         """
                         UPDATE payroll_runs SET status = 'reversed', notes = COALESCE(notes,'') || ' | reversed'
                         WHERE id = @id
                         """, conn, (NpgsqlTransaction)tx))
        {
            mark.Parameters.AddWithValue("id", runId);
            await mark.ExecuteNonQueryAsync(ct);
        }

        await using var create = new NpgsqlCommand(
            """
            INSERT INTO payroll_runs (period_year, period_month, legal_entity_id, status, label, is_preview,
                                      created_by_email, reversed_run_id, notes)
            VALUES (@y, @m, @leid, 'draft', @label, TRUE, @email, @rev, @notes)
            RETURNING *
            """, conn, (NpgsqlTransaction)tx);
        create.Parameters.AddWithValue("y", year);
        create.Parameters.AddWithValue("m", month);
        create.Parameters.AddWithValue("leid", leid ?? DBNull.Value);
        create.Parameters.AddWithValue("label", periodKey);
        create.Parameters.AddWithValue("email", (object?)actorEmail ?? DBNull.Value);
        create.Parameters.AddWithValue("rev", runId);
        create.Parameters.AddWithValue("notes", $"Reversal draft of run #{runId}");
        var draft = await ReadOneAsync(create, ct);
        var newId = Convert.ToInt32(draft!["id"]);

        await AddEventAsync(conn, (NpgsqlTransaction)tx, runId, from, "reversed", actorEmail, actorRole, "reverse", ct);
        await AddEventAsync(conn, (NpgsqlTransaction)tx, newId, null, "draft", actorEmail, actorRole,
            $"opened after reverse of #{runId}", ct);

        // Soft-void payslips for period (keep history via run lines)
        await using (var voidSlips = new NpgsqlCommand(
                         """
                         UPDATE payslips SET wps_ref = COALESCE(wps_ref,'') || '-REVERSED'
                         WHERE period_label = @p AND wps_ref NOT LIKE '%-REVERSED'
                         """, conn, (NpgsqlTransaction)tx))
        {
            voidSlips.Parameters.AddWithValue("p", periodKey);
            await voidSlips.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);
        await _hr.WriteAuditAsync(actorEmail, actorRole, "payroll_reverse", "payroll_run", runId,
            $"newDraft={newId}", ct);

        return (new { reversedRunId = runId, newDraft = draft, isPreview = true }, null);
    }

    public async Task<(string Content, string FileName, string? Error, bool IsPreview)> BuildSifFromRunAsync(
        int runId, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var runCmd = new NpgsqlCommand("SELECT * FROM payroll_runs WHERE id = @id", conn);
        runCmd.Parameters.AddWithValue("id", runId);
        var run = await ReadOneAsync(runCmd, ct);
        if (run is null) return ("", "", "Run not found", true);

        var status = Convert.ToString(run["status"]) ?? "";
        if (status is not ("approved" or "paid" or "closed"))
            return ("", "", $"SIF export allowed only after approve (current: {status})", true);

        string? bank = null;
        string? employerId = null;
        string? spec = null;
        var leid = run["legal_entity_id"];
        if (leid is not null and not DBNull)
        {
            await using var cfg = new NpgsqlCommand(
                """
                SELECT bank_or_exchange_name, wps_employer_unique_id, sif_spec_version
                FROM payroll_employer_config
                WHERE legal_entity_id = @eid AND effective_to IS NULL
                ORDER BY id DESC LIMIT 1
                """, conn);
            cfg.Parameters.AddWithValue("eid", Convert.ToInt32(leid));
            await using var r = await cfg.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct))
            {
                bank = r.IsDBNull(0) ? null : r.GetString(0);
                employerId = r.IsDBNull(1) ? null : r.GetString(1);
                spec = r.IsDBNull(2) ? null : r.GetString(2);
            }
        }

        var year = Convert.ToInt32(run["period_year"]);
        var month = Convert.ToInt32(run["period_month"]);
        var sb = new StringBuilder();
        sb.AppendLine("# GOCs HR — WPS/SIF from locked payroll run (awaiting bank field-map validation)");
        sb.AppendLine($"# run_id={runId}; status={status}; period={year:D4}-{month:D2}");
        sb.AppendLine($"# bank_or_exchange={bank ?? "PENDING"}");
        sb.AppendLine($"# sif_spec_version={spec ?? "PENDING_SIR_SPEC"}");
        sb.AppendLine($"# wps_employer_unique_id={employerId ?? "PENDING"}");
        sb.AppendLine("EmpCode,EmployeeName,IBAN,MOL_ID,Basic,Allowances,Overtime,UnpaidDeduction,GPSSA_Employee,Net,PaymentMethod,WpsReady,RunId");

        await using var lines = new NpgsqlCommand(
            """
            SELECT emp_code, full_name, iban, mol_id, basic_salary, allowances, overtime_amount,
                   unpaid_leave_deduction, gpssa_employee, net, payment_method, wps_ready
            FROM payroll_run_lines
            WHERE payroll_run_id = @id AND COALESCE(payment_method,'wps') = 'wps'
            ORDER BY emp_code
            """, conn);
        lines.Parameters.AddWithValue("id", runId);
        await using var lr = await lines.ExecuteReaderAsync(ct);
        while (await lr.ReadAsync(ct))
        {
            sb.Append(Csv(lr.IsDBNull(0) ? "" : lr.GetString(0))).Append(',');
            sb.Append(Csv(lr.IsDBNull(1) ? "" : lr.GetString(1))).Append(',');
            sb.Append(Csv(lr.IsDBNull(2) ? "" : lr.GetString(2))).Append(',');
            sb.Append(Csv(lr.IsDBNull(3) ? "" : lr.GetString(3))).Append(',');
            sb.Append(Dec(lr, 4)).Append(',');
            sb.Append(Dec(lr, 5)).Append(',');
            sb.Append(Dec(lr, 6)).Append(',');
            sb.Append(Dec(lr, 7)).Append(',');
            sb.Append(Dec(lr, 8)).Append(',');
            sb.Append(Dec(lr, 9)).Append(',');
            sb.Append(Csv(lr.IsDBNull(10) ? "wps" : lr.GetString(10))).Append(',');
            sb.Append(lr.IsDBNull(11) ? "false" : lr.GetBoolean(11).ToString().ToLowerInvariant()).Append(',');
            sb.AppendLine(runId.ToString());
        }

        var fileName = $"wps-sif-run{runId}-{year:D4}{month:D2}.csv";
        var stillPreview = string.IsNullOrWhiteSpace(employerId) || spec is null or "PENDING_SIR_SPEC";
        return (sb.ToString(), fileName, null, stillPreview);
    }

    public async Task<object> EmiratisationGpssaReportAsync(CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            SELECT
              COUNT(*) FILTER (WHERE status = 'active' AND in_hr_ops)::int AS active_headcount,
              COUNT(*) FILTER (WHERE status = 'active' AND in_hr_ops AND COALESCE(is_emirati, FALSE))::int AS emirati_count,
              COUNT(*) FILTER (WHERE status = 'active' AND in_hr_ops AND COALESCE(nafis_registered, FALSE))::int AS nafis_count,
              COUNT(*) FILTER (WHERE status = 'active' AND in_hr_ops
                AND (COALESCE(is_emirati, FALSE) OR lower(COALESCE(pension_authority,'')) IN ('gpssa','uae')))::int AS gpssa_eligible
            FROM employees
            """, conn);
        var row = await ReadOneAsync(cmd, ct) ?? new Dictionary<string, object?>();
        var active = Convert.ToInt32(row.GetValueOrDefault("active_headcount") ?? 0);
        var emirati = Convert.ToInt32(row.GetValueOrDefault("emirati_count") ?? 0);
        var pct = active == 0 ? 0m : Math.Round(100m * emirati / active, 2);
        return new
        {
            isPreview = true,
            previewLabel = "Emiratisation / GPSSA monitoring — rates placeholder until sir policy",
            activeHeadcount = active,
            emiratiCount = emirati,
            emiratisationPct = pct,
            nafisRegistered = Convert.ToInt32(row.GetValueOrDefault("nafis_count") ?? 0),
            gpssaEligible = Convert.ToInt32(row.GetValueOrDefault("gpssa_eligible") ?? 0),
            note = "Set employees.is_emirati / pension_authority / pension_contribution_salary for live calcs.",
        };
    }

    private static async Task AddEventAsync(
        NpgsqlConnection conn, NpgsqlTransaction tx, int runId, string? from, string to,
        string? email, string? role, string? note, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO payroll_run_events (payroll_run_id, from_status, to_status, actor_email, actor_role, note)
            VALUES (@id, @from, @to, @email, @role, @note)
            """, conn, tx);
        cmd.Parameters.AddWithValue("id", runId);
        cmd.Parameters.AddWithValue("from", (object?)from ?? DBNull.Value);
        cmd.Parameters.AddWithValue("to", to);
        cmd.Parameters.AddWithValue("email", (object?)email ?? DBNull.Value);
        cmd.Parameters.AddWithValue("role", (object?)role ?? DBNull.Value);
        cmd.Parameters.AddWithValue("note", (object?)note ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static string Dec(NpgsqlDataReader r, int i) =>
        r.IsDBNull(i) ? "0.00" : r.GetDecimal(i).ToString("0.00", CultureInfo.InvariantCulture);

    private static string Csv(string value)
    {
        if (value.Contains('"') || value.Contains(',') || value.Contains('\n'))
            return '"' + value.Replace("\"", "\"\"") + '"';
        return value;
    }
}
