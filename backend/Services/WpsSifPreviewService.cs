using System.Text;
using DigitalDive.Hr.Api.Data;
using Npgsql;

namespace DigitalDive.Hr.Api.Services;

/// <summary>
/// WPS / SIF file builder — preview CSV skeleton until bank field map is provided by sir.
/// </summary>
public sealed class WpsSifPreviewService
{
    private readonly Db _db;
    public WpsSifPreviewService(Db db) => _db = db;

    public async Task<(string Content, string FileName, bool IsPreview, string? Warning)> BuildPreviewSifAsync(
        int? legalEntityId,
        int year,
        int month,
        CancellationToken ct)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        string? bank = null;
        string? employerId = null;
        string? spec = null;
        var fieldMap = "{}";

        if (legalEntityId is > 0)
        {
            await using var cfg = new NpgsqlCommand(
                """
                SELECT bank_or_exchange_name, wps_employer_unique_id, sif_spec_version, sif_field_map_json::text
                FROM payroll_employer_config
                WHERE legal_entity_id = @eid AND effective_to IS NULL
                ORDER BY id DESC LIMIT 1
                """, conn);
            cfg.Parameters.AddWithValue("eid", legalEntityId.Value);
            await using var r = await cfg.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct))
            {
                bank = r.IsDBNull(0) ? null : r.GetString(0);
                employerId = r.IsDBNull(1) ? null : r.GetString(1);
                spec = r.IsDBNull(2) ? null : r.GetString(2);
                fieldMap = r.IsDBNull(3) ? "{}" : r.GetString(3);
            }
            await r.CloseAsync();
        }

        var sb = new StringBuilder();
        sb.AppendLine("# GOCs HR — WPS/SIF PREVIEW (not bank-validated)");
        sb.AppendLine($"# period={year:D4}-{month:D2}");
        sb.AppendLine($"# bank_or_exchange={bank ?? "PENDING"}");
        sb.AppendLine($"# sif_spec_version={spec ?? "PENDING_SIR_SPEC"}");
        sb.AppendLine($"# wps_employer_unique_id={employerId ?? "PENDING"}");
        sb.AppendLine($"# field_map={fieldMap}");
        sb.AppendLine("EmpCode,EmployeeName,IBAN,MOL_ID,Basic,Allowances,Deductions,Net,PaymentMethod,PreviewFlag");

        // Prefer latest non-reversed run lines for the period when present
        await using var runLines = new NpgsqlCommand(
            """
            SELECT l.emp_code, l.full_name, l.iban, l.mol_id, l.basic_salary, l.allowances,
                   l.unpaid_leave_deduction + l.other_deductions AS deductions, l.net, l.payment_method
            FROM payroll_run_lines l
            JOIN payroll_runs r ON r.id = l.payroll_run_id
            WHERE r.period_year = @y AND r.period_month = @m
              AND r.status NOT IN ('reversed')
              AND (@leid IS NULL OR r.legal_entity_id = @leid OR r.legal_entity_id IS NULL)
            ORDER BY r.id DESC, l.emp_code
            """, conn);
        runLines.Parameters.AddWithValue("y", year);
        runLines.Parameters.AddWithValue("m", month);
        runLines.Parameters.AddWithValue("leid", (object?)legalEntityId ?? DBNull.Value);

        var usedRun = false;
        await using (var lr = await runLines.ExecuteReaderAsync(ct))
        {
            while (await lr.ReadAsync(ct))
            {
                usedRun = true;
                sb.Append(Csv(lr.IsDBNull(0) ? "" : lr.GetString(0))).Append(',');
                sb.Append(Csv(lr.IsDBNull(1) ? "" : lr.GetString(1))).Append(',');
                sb.Append(Csv(lr.IsDBNull(2) ? "" : lr.GetString(2))).Append(',');
                sb.Append(Csv(lr.IsDBNull(3) ? "" : lr.GetString(3))).Append(',');
                sb.Append((lr.IsDBNull(4) ? 0m : lr.GetDecimal(4)).ToString("0.00")).Append(',');
                sb.Append((lr.IsDBNull(5) ? 0m : lr.GetDecimal(5)).ToString("0.00")).Append(',');
                sb.Append((lr.IsDBNull(6) ? 0m : lr.GetDecimal(6)).ToString("0.00")).Append(',');
                sb.Append((lr.IsDBNull(7) ? 0m : lr.GetDecimal(7)).ToString("0.00")).Append(',');
                sb.Append(Csv(lr.IsDBNull(8) ? "wps" : lr.GetString(8))).Append(',');
                sb.AppendLine("PREVIEW_FROM_RUN");
            }
        }

        if (!usedRun)
        {
        await using var empCmd = new NpgsqlCommand(
            """
            SELECT e.emp_code, e.full_name, e.basic_salary, e.allowances,
                   e.master_data->>'iban' AS iban,
                   e.master_data->>'molId' AS mol_id,
                   COALESCE(d.payroll_type, 'wps') AS payment_method
            FROM employees e
            LEFT JOIN divisions d ON d.id = e.division_id
            WHERE e.in_hr_ops = TRUE AND e.status <> 'exited'
            ORDER BY e.emp_code
            """, conn);
        await using var er = await empCmd.ExecuteReaderAsync(ct);
        while (await er.ReadAsync(ct))
        {
            var basic = er.IsDBNull(2) ? 0m : er.GetDecimal(2);
            var allow = er.IsDBNull(3) ? 0m : er.GetDecimal(3);
            var net = basic + allow;
            sb.Append(Csv(er.IsDBNull(0) ? "" : er.GetString(0))).Append(',');
            sb.Append(Csv(er.IsDBNull(1) ? "" : er.GetString(1))).Append(',');
            sb.Append(Csv(er.IsDBNull(4) ? "" : er.GetString(4))).Append(',');
            sb.Append(Csv(er.IsDBNull(5) ? "" : er.GetString(5))).Append(',');
            sb.Append(basic.ToString("0.00")).Append(',');
            sb.Append(allow.ToString("0.00")).Append(',');
            sb.Append("0.00").Append(',');
            sb.Append(net.ToString("0.00")).Append(',');
            sb.Append(Csv(er.IsDBNull(6) ? "wps" : er.GetString(6))).Append(',');
            sb.AppendLine("PREVIEW");
        }
        }

        var warning = string.IsNullOrWhiteSpace(employerId) || spec is null or "PENDING_SIR_SPEC"
            ? "Preview only: plug bank SIF field map and employer WPS ID from Phase 0 / sir before production use."
            : "Preview export — still requires external bank validation.";

        var fileName = $"wps-sif-preview-{year:D4}{month:D2}.csv";
        return (sb.ToString(), fileName, true, warning);
    }

    private static string Csv(string value)
    {
        if (value.Contains('"') || value.Contains(',') || value.Contains('\n'))
            return '"' + value.Replace("\"", "\"\"") + '"';
        return value;
    }
}
