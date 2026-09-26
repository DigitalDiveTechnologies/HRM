using System.Data.Common;
using System.Globalization;
using System.Text;
using DigitalDive.Hr.Api.Data;
using Npgsql;

namespace DigitalDive.Hr.Api.Services;

/// <summary>Phase 5 Scale — system config, job runs, analytics pack, CSV exports.</summary>
public sealed class OpsScaleService
{
    private readonly Db _db;

    public OpsScaleService(Db db) => _db = db;

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

    private static async Task<List<Dictionary<string, object?>>> QueryAsync(
        NpgsqlConnection conn, string sql, CancellationToken ct, params (string, object?)[] args)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var (n, v) in args)
            cmd.Parameters.AddWithValue(n, v ?? DBNull.Value);
        var list = new List<Dictionary<string, object?>>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            list.Add(Row(reader));
        return list;
    }

    private static async Task<int> ScalarIntAsync(
        NpgsqlConnection conn, string sql, CancellationToken ct, params (string, object?)[] args)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var (n, v) in args)
            cmd.Parameters.AddWithValue(n, v ?? DBNull.Value);
        var o = await cmd.ExecuteScalarAsync(ct);
        return o is null or DBNull ? 0 : Convert.ToInt32(o);
    }

    public async Task<object> ReadyAsync(CancellationToken ct)
    {
        var checks = new Dictionary<string, object?>();
        var ok = true;
        try
        {
            await using var conn = await OpenAsync(ct);
            await using var cmd = new NpgsqlCommand("SELECT 1", conn);
            await cmd.ExecuteScalarAsync(ct);
            checks["database"] = new { ok = true };
            checks["notifications_table"] = new
            {
                ok = await ScalarIntAsync(conn,
                    "SELECT COUNT(*)::int FROM information_schema.tables WHERE table_name = 'notifications'", ct) > 0
            };
            checks["audit_logs_table"] = new
            {
                ok = await ScalarIntAsync(conn,
                    "SELECT COUNT(*)::int FROM information_schema.tables WHERE table_name = 'audit_logs'", ct) > 0
            };
            checks["system_config_table"] = new
            {
                ok = await ScalarIntAsync(conn,
                    "SELECT COUNT(*)::int FROM information_schema.tables WHERE table_name = 'system_config'", ct) > 0
            };
        }
        catch (Exception ex)
        {
            ok = false;
            checks["database"] = new { ok = false, error = ex.Message };
        }

        return new
        {
            ready = ok,
            service = "DigitalDive.Hr.Api",
            phase = "5-scale",
            utc = DateTime.UtcNow.ToString("o"),
            checks
        };
    }

    public Task<List<Dictionary<string, object?>>> ListConfigAsync(CancellationToken ct) =>
        QueryConnAsync("SELECT key, value, description, updated_at, updated_by FROM system_config ORDER BY key", ct);

    public async Task<object> GetOrgBrandAsync(CancellationToken ct)
    {
        string displayName = "GOCs";
        string logoUrl = "";
        try
        {
            var rows = await QueryConnAsync(
                """
                SELECT key, value FROM system_config
                WHERE key IN ('org.display_name', 'org.logo_url')
                """,
                ct);
            foreach (var row in rows)
            {
                var key = row.GetValueOrDefault("key")?.ToString() ?? "";
                var value = row.GetValueOrDefault("value")?.ToString() ?? "";
                if (string.Equals(key, "org.display_name", StringComparison.OrdinalIgnoreCase)
                    && !string.IsNullOrWhiteSpace(value))
                    displayName = value.Trim();
                if (string.Equals(key, "org.logo_url", StringComparison.OrdinalIgnoreCase))
                    logoUrl = value ?? "";
            }
        }
        catch
        {
            // system_config missing — fallback brand
        }

        return new { displayName, logoUrl, tagline = "HR Portal · UAE" };
    }

    /// <summary>
    /// Idempotent bootstrap: unique company names, hide legacy codes, org brand keys, brand permission.
    /// </summary>
    public async Task EnsureCompanyBrandSetupAsync(CancellationToken ct = default)
    {
        try
        {
            await using var conn = await OpenAsync(ct);

            // Clear business codes to synthetic C{id} (safe unique values; UI no longer shows code)
            await using (var clear = new NpgsqlCommand(
                "UPDATE divisions SET code = 'C' || id::text WHERE code !~ '^C[0-9]+$'", conn))
            {
                await clear.ExecuteNonQueryAsync(ct);
            }

            await using (var idx = new NpgsqlCommand(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS divisions_name_lower_uidx
                ON divisions (LOWER(TRIM(name)))
                """,
                conn))
            {
                await idx.ExecuteNonQueryAsync(ct);
            }

            await using (var cfg = new NpgsqlCommand(
                """
                INSERT INTO system_config (key, value, description) VALUES
                  ('org.display_name', 'GOCs', 'All Companies sidebar brand name'),
                  ('org.logo_url', '', 'All Companies sidebar logo (data URL or path)')
                ON CONFLICT (key) DO NOTHING
                """,
                conn))
            {
                await cfg.ExecuteNonQueryAsync(ct);
            }

            await using (var perm = new NpgsqlCommand(
                """
                INSERT INTO permissions (code, name, group_code, group_name, parent_code, path, sort_order)
                VALUES ('company.brand.edit', 'Edit All Companies Brand', 'core_hr', 'Core HR', 'company', '/dashboard', 101)
                ON CONFLICT (code) DO UPDATE SET
                  name = EXCLUDED.name,
                  group_code = EXCLUDED.group_code,
                  group_name = EXCLUDED.group_name,
                  parent_code = EXCLUDED.parent_code,
                  path = EXCLUDED.path,
                  sort_order = EXCLUDED.sort_order
                """,
                conn))
            {
                await perm.ExecuteNonQueryAsync(ct);
            }

            await using (var grant = new NpgsqlCommand(
                """
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id
                FROM roles r
                CROSS JOIN permissions p
                WHERE LOWER(r.code) = 'admin'
                ON CONFLICT DO NOTHING
                """,
                conn))
            {
                await grant.ExecuteNonQueryAsync(ct);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"EnsureCompanyBrandSetup skipped: {ex.Message}");
        }
    }

    public async Task<Dictionary<string, object?>?> UpsertConfigAsync(
        string key, string value, string? description, string? actorEmail, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key)) return null;
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO system_config (key, value, description, updated_at, updated_by)
            VALUES (@key, @value, @desc, NOW(), @by)
            ON CONFLICT (key) DO UPDATE
              SET value = EXCLUDED.value,
                  description = COALESCE(EXCLUDED.description, system_config.description),
                  updated_at = NOW(),
                  updated_by = EXCLUDED.updated_by
            RETURNING key, value, description, updated_at, updated_by
            """, conn);
        cmd.Parameters.AddWithValue("key", key.Trim());
        cmd.Parameters.AddWithValue("value", value ?? "");
        cmd.Parameters.AddWithValue("desc", (object?)description ?? DBNull.Value);
        cmd.Parameters.AddWithValue("by", (object?)actorEmail ?? DBNull.Value);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? Row(reader) : null;
    }

    public Task<List<Dictionary<string, object?>>> JobRunsAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT id, job_name, status, started_at, finished_at, detail, actor_email
            FROM job_runs
            ORDER BY id DESC
            LIMIT 50
            """, ct);

    public async Task<int> BeginJobAsync(string jobName, string? actorEmail, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO job_runs (job_name, status, actor_email)
            VALUES (@name, 'running', @email)
            RETURNING id
            """, conn);
        cmd.Parameters.AddWithValue("name", jobName);
        cmd.Parameters.AddWithValue("email", (object?)actorEmail ?? DBNull.Value);
        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
    }

    public async Task FinishJobAsync(int id, bool succeeded, string? detail, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE job_runs
            SET status = @status, finished_at = NOW(), detail = @detail
            WHERE id = @id
            """, conn);
        cmd.Parameters.AddWithValue("status", succeeded ? "succeeded" : "failed");
        cmd.Parameters.AddWithValue("detail", (object?)detail ?? DBNull.Value);
        cmd.Parameters.AddWithValue("id", id);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<object> AnalyticsPackAsync(CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        var attrition = (await QueryAsync(conn,
            """
            SELECT
              COUNT(*) FILTER (WHERE status = 'active')::int AS active,
              COUNT(*) FILTER (WHERE status = 'onboarding')::int AS onboarding,
              COUNT(*) FILTER (WHERE status = 'exited')::int AS exited,
              COUNT(*) FILTER (WHERE is_emirati = TRUE AND status != 'exited')::int AS emirati_active,
              COUNT(*) FILTER (WHERE status != 'exited' AND in_hr_ops = TRUE)::int AS workforce
            FROM employees WHERE in_hr_ops = TRUE
            """, ct)).FirstOrDefault() ?? new Dictionary<string, object?>();

        var complianceDue = await QueryAsync(conn,
            """
            SELECT status, COUNT(*)::int AS total
            FROM compliance_items
            GROUP BY status
            ORDER BY total DESC
            """, ct);

        var renewals = await QueryAsync(conn,
            """
            SELECT status, COUNT(*)::int AS total
            FROM document_renewal_tasks
            GROUP BY status
            ORDER BY total DESC
            """, ct);

        var wpsGaps = await QueryAsync(conn,
            """
            SELECT e.emp_code, e.full_name,
                   (COALESCE(TRIM(e.master_data->>'iban'),'') = '') AS missing_iban,
                   (COALESCE(TRIM(COALESCE(e.master_data->>'molId', e.master_data->>'mol_id')),'') = '') AS missing_mol
            FROM employees e
            WHERE e.in_hr_ops = TRUE AND e.status = 'active'
              AND (
                COALESCE(TRIM(e.master_data->>'iban'),'') = ''
                OR COALESCE(TRIM(COALESCE(e.master_data->>'molId', e.master_data->>'mol_id')),'') = ''
              )
            ORDER BY e.emp_code
            LIMIT 100
            """, ct);

        var auditRecent = await QueryAsync(conn,
            """
            SELECT id, actor_email, actor_role, action, entity_type, entity_id, detail, created_at
            FROM audit_logs
            ORDER BY id DESC
            LIMIT 25
            """, ct);

        var openExits = await ScalarIntAsync(conn,
            "SELECT COUNT(*)::int FROM exit_cases WHERE status IN ('open','in_progress')", ct);
        var unreadNotifs = await ScalarIntAsync(conn,
            "SELECT COUNT(*)::int FROM notifications WHERE is_read = FALSE", ct);
        var pendingLeave = await ScalarIntAsync(conn,
            "SELECT COUNT(*)::int FROM leave_requests WHERE status = 'pending'", ct);

        var workforce = Convert.ToInt32(attrition.GetValueOrDefault("workforce") ?? 0);
        var emirati = Convert.ToInt32(attrition.GetValueOrDefault("emirati_active") ?? 0);
        var emiratisationPct = workforce > 0 ? Math.Round(100.0 * emirati / workforce, 2) : 0;

        return new
        {
            attrition,
            emiratisation = new { workforce, emirati, percent = emiratisationPct, isPreview = true },
            complianceDue,
            renewals,
            wpsGaps,
            auditRecent,
            ops = new { openExits, unreadNotifs, pendingLeave }
        };
    }

    public async Task<(string FileName, string Csv, int Rows)> ExportCsvAsync(
        string reportKey, string? actorEmail, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        List<Dictionary<string, object?>> rows;
        string[] headers;
        string file;

        switch ((reportKey ?? "").Trim().ToLowerInvariant())
        {
            case "headcount":
                file = "headcount_by_dept.csv";
                headers = ["name", "total"];
                rows = await QueryAsync(conn,
                    """
                    SELECT d.name, COUNT(e.id)::int AS total
                    FROM departments d
                    LEFT JOIN employees e ON e.department_id = d.id AND e.status != 'exited' AND e.in_hr_ops = TRUE
                    GROUP BY d.name ORDER BY total DESC
                    """, ct);
                break;
            case "compliance":
                file = "compliance_items.csv";
                headers = ["id", "employee_id", "title", "category", "due_date", "status"];
                rows = await QueryAsync(conn,
                    "SELECT id, employee_id, title, category, due_date, status FROM compliance_items ORDER BY id DESC LIMIT 500", ct);
                break;
            case "wps-gaps":
                file = "wps_readiness_gaps.csv";
                headers = ["emp_code", "full_name", "missing_iban", "missing_mol"];
                rows = await QueryAsync(conn,
                    """
                    SELECT e.emp_code, e.full_name,
                           (COALESCE(TRIM(e.master_data->>'iban'),'') = '') AS missing_iban,
                           (COALESCE(TRIM(COALESCE(e.master_data->>'molId', e.master_data->>'mol_id')),'') = '') AS missing_mol
                    FROM employees e
                    WHERE e.in_hr_ops = TRUE AND e.status = 'active'
                    ORDER BY e.emp_code
                    """, ct);
                break;
            case "audit":
                file = "audit_logs.csv";
                headers = ["id", "actor_email", "actor_role", "action", "entity_type", "entity_id", "detail", "created_at"];
                rows = await QueryAsync(conn,
                    """
                    SELECT id, actor_email, actor_role, action, entity_type, entity_id, detail, created_at
                    FROM audit_logs ORDER BY id DESC LIMIT 500
                    """, ct);
                break;
            case "attrition":
                file = "attrition_status.csv";
                headers = ["status", "total"];
                rows = await QueryAsync(conn,
                    """
                    SELECT status, COUNT(*)::int AS total
                    FROM employees WHERE in_hr_ops = TRUE
                    GROUP BY status ORDER BY total DESC
                    """, ct);
                break;
            default:
                throw new ArgumentException("Unknown reportKey. Use: headcount, compliance, wps-gaps, audit, attrition");
        }

        var sb = new StringBuilder();
        sb.AppendLine(string.Join(',', headers));
        foreach (var r in rows)
        {
            var cells = headers.Select(h =>
            {
                r.TryGetValue(h, out var val);
                var s = Convert.ToString(val, CultureInfo.InvariantCulture) ?? "";
                if (s.Contains(',') || s.Contains('"') || s.Contains('\n'))
                    s = "\"" + s.Replace("\"", "\"\"") + "\"";
                return s;
            });
            sb.AppendLine(string.Join(',', cells));
        }

        await using (var log = new NpgsqlCommand(
                         """
                         INSERT INTO report_exports (report_key, format, row_count, actor_email)
                         VALUES (@k, 'csv', @n, @email)
                         """, conn))
        {
            log.Parameters.AddWithValue("k", (object?)reportKey ?? DBNull.Value);
            log.Parameters.AddWithValue("n", rows.Count);
            log.Parameters.AddWithValue("email", (object?)actorEmail ?? DBNull.Value);
            await log.ExecuteNonQueryAsync(ct);
        }

        return (file, sb.ToString(), rows.Count);
    }

    public Task<List<Dictionary<string, object?>>> ExportHistoryAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT id, report_key, format, row_count, actor_email, created_at
            FROM report_exports
            ORDER BY id DESC
            LIMIT 40
            """, ct);

    private async Task<List<Dictionary<string, object?>>> QueryConnAsync(
        string sql, CancellationToken ct, params (string, object?)[] args)
    {
        await using var conn = await OpenAsync(ct);
        return await QueryAsync(conn, sql, ct, args);
    }
}
