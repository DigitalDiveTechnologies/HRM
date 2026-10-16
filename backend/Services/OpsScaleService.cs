using System.Data.Common;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using DigitalDive.Hr.Api.Data;
using DigitalDive.Hr.Api.Models;
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
        string displayName = "Synergy";
        string logoUrl = "/media/synergy-logo.png";
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
                {
                    var legacy = value.Trim();
                    displayName = legacy.Equals("GOCs", StringComparison.OrdinalIgnoreCase)
                        || legacy.Equals("GOCs HR", StringComparison.OrdinalIgnoreCase)
                        || legacy.Equals("GOCs Global", StringComparison.OrdinalIgnoreCase)
                        ? "Synergy"
                        : legacy;
                }
                if (string.Equals(key, "org.logo_url", StringComparison.OrdinalIgnoreCase))
                    if (!string.IsNullOrWhiteSpace(value)) logoUrl = value;
            }
        }
        catch
        {
            // system_config missing — fallback brand
        }

        return new { displayName, logoUrl, tagline = "HR Management" };
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

            await using (var locCols = new NpgsqlCommand(
                """
                ALTER TABLE attendance
                  ADD COLUMN IF NOT EXISTS check_in_latitude DOUBLE PRECISION,
                  ADD COLUMN IF NOT EXISTS check_in_longitude DOUBLE PRECISION,
                  ADD COLUMN IF NOT EXISTS check_out_latitude DOUBLE PRECISION,
                  ADD COLUMN IF NOT EXISTS check_out_longitude DOUBLE PRECISION,
                  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
                  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
                """,
                conn))
            {
                await locCols.ExecuteNonQueryAsync(ct);
            }

            await using (var annCmd = new NpgsqlCommand(
                """
                CREATE TABLE IF NOT EXISTS company_announcements (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    body_html TEXT NOT NULL,
                    category VARCHAR(64) DEFAULT 'General',
                    priority VARCHAR(32) DEFAULT 'normal',
                    audience_type VARCHAR(32) DEFAULT 'all',
                    division_id INT REFERENCES divisions(id) ON DELETE SET NULL,
                    department_id INT REFERENCES departments(id) ON DELETE SET NULL,
                    requires_ack BOOLEAN NOT NULL DEFAULT FALSE,
                    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
                    author_email VARCHAR(255),
                    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    expires_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS idx_company_announcements_published ON company_announcements(published_at DESC);
                CREATE INDEX IF NOT EXISTS idx_company_announcements_audience ON company_announcements(audience_type, division_id, department_id);

                CREATE TABLE IF NOT EXISTS announcement_acks (
                    id SERIAL PRIMARY KEY,
                    announcement_id INT NOT NULL REFERENCES company_announcements(id) ON DELETE CASCADE,
                    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    ip_address VARCHAR(64),
                    CONSTRAINT uq_announcement_ack UNIQUE (announcement_id, employee_id)
                );

                CREATE INDEX IF NOT EXISTS idx_announcement_acks_ann_emp ON announcement_acks(announcement_id, employee_id);
                """,
                conn))
            {
                await annCmd.ExecuteNonQueryAsync(ct);
            }

            await using (var linksCmd = new NpgsqlCommand(
                """
                CREATE TABLE IF NOT EXISTS company_links (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(100) NOT NULL,
                    url VARCHAR(500) NOT NULL,
                    icon_key VARCHAR(50) NOT NULL DEFAULT 'external-link',
                    category VARCHAR(50) NOT NULL DEFAULT 'General',
                    sort_order INT NOT NULL DEFAULT 0,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_company_links_active ON company_links(is_active, sort_order);

                CREATE TABLE IF NOT EXISTS digital_signatures (
                    id SERIAL PRIMARY KEY,
                    document_type VARCHAR(50) NOT NULL,
                    document_id INT NOT NULL,
                    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                    signer_email VARCHAR(120) NOT NULL,
                    signature_base64 TEXT NOT NULL,
                    document_sha256 VARCHAR(64) NOT NULL,
                    ip_address VARCHAR(50) NOT NULL,
                    signed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_digital_signatures_doc ON digital_signatures(document_type, document_id);
                CREATE INDEX IF NOT EXISTS idx_digital_signatures_emp ON digital_signatures(employee_id);

                INSERT INTO company_links (title, url, icon_key, category, sort_order, is_active)
                SELECT * FROM (VALUES
                    ('MOHRE UAE Portal', 'https://www.mohre.gov.ae', 'globe', 'Government & Labour', 10, true),
                    ('UAE PASS Digital ID', 'https://selfcare.uaepass.ae', 'shield', 'Government & Labour', 20, true),
                    ('Corporate Webmail (Office 365)', 'https://outlook.office.com', 'mail', 'Productivity', 30, true),
                    ('Medical Insurance Claims (Daman)', 'https://www.damanhealth.ae', 'heart', 'Health & Wellness', 40, true),
                    ('IT Service Desk & Support', 'https://support.digitaldive.demo', 'life-buoy', 'IT & Operations', 50, true),
                    ('Employee Handbook & Policies', 'https://gocs-hr-portal.vercel.app/documents', 'book', 'Company Resources', 60, true),
                    ('GOCs Learning Center', 'https://gocs-hr-portal.vercel.app/training', 'award', 'Career & Training', 70, true),
                    ('Dubai Health Authority (DHA)', 'https://www.dha.gov.ae', 'activity', 'Health & Wellness', 80, true)
                ) AS v(title, url, icon_key, category, sort_order, is_active)
                WHERE NOT EXISTS (SELECT 1 FROM company_links LIMIT 1);
                """,
                conn))
            await using (var benCmd = new NpgsqlCommand(
                """
                CREATE TABLE IF NOT EXISTS benefit_plans (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(120) NOT NULL,
                    benefit_type VARCHAR(50) NOT NULL DEFAULT 'medical_insurance',
                    provider_name VARCHAR(100) NOT NULL,
                    policy_number VARCHAR(100) NOT NULL,
                    coverage_summary TEXT,
                    annual_premium_employer NUMERIC(12,2) NOT NULL DEFAULT 0.00,
                    annual_premium_employee NUMERIC(12,2) NOT NULL DEFAULT 0.00,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS employee_benefits (
                    id SERIAL PRIMARY KEY,
                    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                    benefit_plan_id INT NOT NULL REFERENCES benefit_plans(id) ON DELETE RESTRICT,
                    member_id VARCHAR(100),
                    coverage_tier VARCHAR(50) NOT NULL DEFAULT 'employee_only',
                    dependents_count INT NOT NULL DEFAULT 0,
                    start_date DATE NOT NULL,
                    end_date DATE NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'active',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_emp_benefits ON employee_benefits(employee_id, status);
                """,
                conn))
            {
                await benCmd.ExecuteNonQueryAsync(ct);
            }

            await using (var cfg = new NpgsqlCommand(

                """
                INSERT INTO system_config (key, value, description) VALUES
                  ('org.display_name', 'Synergy', 'All Companies sidebar brand name'),
                  ('org.logo_url', '/media/synergy-logo.png', 'All Companies sidebar logo (data URL or path)')
                ON CONFLICT (key) DO NOTHING
                """,
                conn))
            {
                await cfg.ExecuteNonQueryAsync(ct);
            }

            await using (var perm = new NpgsqlCommand(
                """
                INSERT INTO permissions (code, name, group_code, group_name, parent_code, path, sort_order)
                VALUES ('company.brand.edit', 'Edit Synergy (All Companies) name & logo', 'core_hr', 'Core HR', 'company', '/dashboard', 101)
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

            // Clarify label for existing installs (name only)
            await using (var rename = new NpgsqlCommand(
                """
                UPDATE permissions
                SET name = 'Edit Synergy (All Companies) name & logo'
                WHERE code = 'company.brand.edit'
                """,
                conn))
            {
                await rename.ExecuteNonQueryAsync(ct);
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

    private static readonly Dictionary<string, (string SqlExpr, string Header)> ColumnWhitelist = new(StringComparer.OrdinalIgnoreCase)
    {
        ["emp_code"] = ("e.emp_code", "Employee Code"),
        ["full_name"] = ("e.full_name", "Full Name"),
        ["email"] = ("e.email", "Work Email"),
        ["phone"] = ("COALESCE(e.phone, '')", "Phone Number"),
        ["nationality"] = ("COALESCE(e.nationality, '')", "Nationality"),
        ["dob"] = ("COALESCE(TO_CHAR(e.dob, 'YYYY-MM-DD'), '')", "Date of Birth"),
        ["status"] = ("e.status", "Employment Status"),
        ["is_emirati"] = ("CASE WHEN e.is_emirati THEN 'Yes' ELSE 'No' END", "Is Emirati"),

        ["job_title"] = ("COALESCE(e.job_title, '')", "Job Title"),
        ["department_name"] = ("COALESCE(d.name, '')", "Department"),
        ["division_name"] = ("COALESCE(dv.name, '')", "Division / Company"),
        ["join_date"] = ("COALESCE(TO_CHAR(e.join_date, 'YYYY-MM-DD'), '')", "Join Date"),
        ["contract_end"] = ("COALESCE(TO_CHAR(e.contract_end, 'YYYY-MM-DD'), '')", "Contract End Date"),
        ["probation_end"] = ("COALESCE(TO_CHAR(e.probation_end, 'YYYY-MM-DD'), '')", "Probation End Date"),
        ["manager_name"] = ("COALESCE(m.full_name, '')", "Direct Manager"),

        ["basic_salary"] = ("COALESCE(e.basic_salary, 0)::text", "Basic Salary (Monthly)"),
        ["allowances"] = ("COALESCE(e.allowances, 0)::text", "Allowances (Monthly)"),
        ["gross_salary"] = ("(COALESCE(e.basic_salary, 0) + COALESCE(e.allowances, 0))::text", "Gross Salary (Monthly)"),
        ["annual_cash_salary"] = ("((COALESCE(e.basic_salary, 0) + COALESCE(e.allowances, 0)) * 12)::text", "Annual Cash Salary"),
        ["pension_salary"] = ("COALESCE(e.pension_contribution_salary, 0)::text", "Pension Salary"),

        ["passport_no"] = ("COALESCE(e.passport_no, '')", "Passport Number"),
        ["passport_expiry"] = ("COALESCE(TO_CHAR(e.passport_expiry, 'YYYY-MM-DD'), '')", "Passport Expiry"),
        ["emirates_id"] = ("COALESCE(e.emirates_id, '')", "Emirates ID"),
        ["emirates_id_expiry"] = ("COALESCE(TO_CHAR(e.emirates_id_expiry, 'YYYY-MM-DD'), '')", "Emirates ID Expiry"),
        ["visa_no"] = ("COALESCE(e.visa_no, '')", "Visa Number"),
        ["visa_expiry"] = ("COALESCE(TO_CHAR(e.visa_expiry, 'YYYY-MM-DD'), '')", "Visa Expiry"),
    };

    private async Task<(List<string> Projections, List<string> Headers)> ResolveReportColumnsAsync(
        NpgsqlConnection conn, List<string> requestedColumns, CancellationToken ct)
    {
        var customLabels = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        await using (var cmd = new NpgsqlCommand("SELECT field_key, label FROM custom_field_definitions WHERE is_active = TRUE", conn))
        await using (var rdr = await cmd.ExecuteReaderAsync(ct))
        {
            while (await rdr.ReadAsync(ct))
            {
                customLabels[rdr.GetString(0)] = rdr.GetString(1);
            }
        }

        var projections = new List<string>();
        var headers = new List<string>();

        var cols = (requestedColumns != null && requestedColumns.Count > 0)
            ? requestedColumns
            : new List<string> { "emp_code", "full_name", "department_name", "job_title", "status" };

        foreach (var col in cols)
        {
            var cleanKey = col.Trim();
            if (ColumnWhitelist.TryGetValue(cleanKey, out var entry))
            {
                projections.Add($"{entry.SqlExpr} AS \"{cleanKey}\"");
                headers.Add(entry.Header);
            }
            else if (Regex.IsMatch(cleanKey, "^[a-z0-9_]{1,60}$", RegexOptions.IgnoreCase))
            {
                projections.Add($"COALESCE(e.master_data ->> '{cleanKey.ToLowerInvariant()}', '') AS \"{cleanKey}\"");
                var header = customLabels.TryGetValue(cleanKey, out var lbl)
                    ? lbl
                    : CultureInfo.InvariantCulture.TextInfo.ToTitleCase(cleanKey.Replace('_', ' '));
                headers.Add(header);
            }
        }

        if (projections.Count == 0)
        {
            var fallback = ColumnWhitelist["emp_code"];
            projections.Add($"{fallback.SqlExpr} AS \"emp_code\"");
            headers.Add(fallback.Header);
        }

        return (projections, headers);
    }

    private static (string WhereClause, List<NpgsqlParameter> Parameters) BuildReportWhere(CustomReportFilters? filters)
    {
        var clauses = new List<string> { "e.in_hr_ops = TRUE" };
        var pars = new List<NpgsqlParameter>();

        if (filters != null)
        {
            if (filters.DepartmentId.HasValue && filters.DepartmentId.Value > 0)
            {
                clauses.Add("e.department_id = @deptId");
                pars.Add(new NpgsqlParameter("deptId", filters.DepartmentId.Value));
            }

            if (filters.DivisionId.HasValue && filters.DivisionId.Value > 0)
            {
                clauses.Add("e.division_id = @divId");
                pars.Add(new NpgsqlParameter("divId", filters.DivisionId.Value));
            }

            if (!string.IsNullOrWhiteSpace(filters.Status) && !filters.Status.Equals("all", StringComparison.OrdinalIgnoreCase))
            {
                clauses.Add("LOWER(e.status) = LOWER(@status)");
                pars.Add(new NpgsqlParameter("status", filters.Status.Trim()));
            }

            if (!string.IsNullOrWhiteSpace(filters.JoinDateStart) && DateTime.TryParse(filters.JoinDateStart, out var jStart))
            {
                clauses.Add("e.join_date >= @jStart");
                pars.Add(new NpgsqlParameter("jStart", jStart.Date));
            }

            if (!string.IsNullOrWhiteSpace(filters.JoinDateEnd) && DateTime.TryParse(filters.JoinDateEnd, out var jEnd))
            {
                clauses.Add("e.join_date <= @jEnd");
                pars.Add(new NpgsqlParameter("jEnd", jEnd.Date));
            }

            if (!string.IsNullOrWhiteSpace(filters.Search))
            {
                clauses.Add("(e.full_name ILIKE @q OR e.emp_code ILIKE @q OR e.email ILIKE @q)");
                pars.Add(new NpgsqlParameter("q", $"%{filters.Search.Trim()}%"));
            }
        }

        return (string.Join(" AND ", clauses), pars);
    }

    public async Task<(string File, string Csv, int Count)> ExportCustomCsvAsync(
        List<string> columns, CustomReportFilters? filters, string? actorEmail, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        var (projections, headers) = await ResolveReportColumnsAsync(conn, columns, ct);
        var (whereSql, pars) = BuildReportWhere(filters);

        var sql =
            $"""
            SELECT {string.Join(", ", projections)}
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN divisions dv ON dv.id = e.division_id
            LEFT JOIN employees m ON m.id = e.manager_id
            WHERE {whereSql}
            ORDER BY e.emp_code
            """;

        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var p in pars) cmd.Parameters.Add(p);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var sb = new StringBuilder();
        sb.Append('\uFEFF');
        sb.AppendLine(string.Join(',', headers.Select(EscapeCsv)));

        var count = 0;
        while (await reader.ReadAsync(ct))
        {
            count++;
            var cells = new string[reader.FieldCount];
            for (var i = 0; i < reader.FieldCount; i++)
            {
                var val = reader.IsDBNull(i) ? "" : Convert.ToString(reader.GetValue(i), CultureInfo.InvariantCulture) ?? "";
                cells[i] = EscapeCsv(val);
            }
            sb.AppendLine(string.Join(',', cells));
        }
        await reader.CloseAsync();

        var fileName = $"Custom-HR-Report-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv";

        try
        {
            await using var log = new NpgsqlCommand(
                """
                INSERT INTO report_exports (report_key, format, row_count, actor_email)
                VALUES ('custom-export', 'csv', @n, @email)
                """, conn);
            log.Parameters.AddWithValue("n", count);
            log.Parameters.AddWithValue("email", (object?)actorEmail ?? DBNull.Value);
            await log.ExecuteNonQueryAsync(ct);
        }
        catch {}

        return (fileName, sb.ToString(), count);
    }

    public async Task<object> PreviewCustomReportAsync(
        List<string> columns, CustomReportFilters? filters, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        var (projections, headers) = await ResolveReportColumnsAsync(conn, columns, ct);
        var (whereSql, pars) = BuildReportWhere(filters);

        var countSql =
            $"""
            SELECT COUNT(*)::int
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN divisions dv ON dv.id = e.division_id
            WHERE {whereSql}
            """;
        await using var countCmd = new NpgsqlCommand(countSql, conn);
        foreach (var p in pars) countCmd.Parameters.Add((NpgsqlParameter)((ICloneable)p).Clone());
        var totalRows = Convert.ToInt32(await countCmd.ExecuteScalarAsync(ct));

        var sql =
            $"""
            SELECT {string.Join(", ", projections)}
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN divisions dv ON dv.id = e.division_id
            LEFT JOIN employees m ON m.id = e.manager_id
            WHERE {whereSql}
            ORDER BY e.emp_code
            LIMIT 15
            """;

        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var p in pars) cmd.Parameters.Add(p);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var preview = new List<Dictionary<string, object?>>();
        while (await reader.ReadAsync(ct))
        {
            var row = new Dictionary<string, object?>();
            for (var i = 0; i < reader.FieldCount; i++)
            {
                row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            }
            preview.Add(row);
        }

        return new
        {
            totalRows,
            previewRows = preview,
            headers,
            columns = columns ?? new List<string>()
        };
    }

    private static string EscapeCsv(string value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
        {
            return "\"" + value.Replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
