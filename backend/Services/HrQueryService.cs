using System.Data;
using System.Data.Common;
using System.Text.Json;
using DigitalDive.Hr.Api.Data;
using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using Npgsql;

namespace DigitalDive.Hr.Api.Services;

public sealed class HrQueryService
{
    private readonly Db _db;
    private readonly EmailService _email;

    public HrQueryService(Db db, EmailService email)
    {
        _db = db;
        _email = email;
    }

    public async Task<object> DashboardAsync(CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        var headcount = await ScalarIntAsync(conn,
            "SELECT COUNT(*)::int FROM employees WHERE status != 'exited' AND in_hr_ops = TRUE", ct);
        var pendingLeave = await ScalarIntAsync(conn,
            """
            SELECT COUNT(*)::int FROM leave_requests l
            JOIN employees e ON e.id = l.employee_id
            WHERE l.status = 'pending' AND e.in_hr_ops = TRUE
            """, ct);
        var expiringDocs = await ScalarIntAsync(conn,
            """
            SELECT COUNT(*)::int FROM documents d
            JOIN employees e ON e.id = d.employee_id
            WHERE d.expiry_date <= CURRENT_DATE + INTERVAL '90 days' AND e.in_hr_ops = TRUE
            """, ct);
        var unread = await ScalarIntAsync(conn,
            "SELECT COUNT(*)::int FROM notifications WHERE is_read = FALSE", ct);
        var recent = await QueryAsync(conn,
            """
            SELECT a.work_date, a.status, a.late_minutes, e.full_name
            FROM attendance a JOIN employees e ON e.id = a.employee_id
            WHERE e.in_hr_ops = TRUE
            ORDER BY a.work_date DESC, a.id DESC LIMIT 8
            """, ct);

        return new
        {
            headcount,
            pendingLeave,
            expiringDocs,
            unreadNotifications = unread,
            recentAttendance = recent
        };
    }

    public Task<List<Dictionary<string, object?>>> EmployeesAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT e.*, d.name AS department_name, m.full_name AS manager_name,
                   dv.name AS division_name, dv.code AS division_code, dv.payroll_type AS division_payroll_type,
                   dg.name AS designation_name, et.name AS employment_type_name
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN employees m ON m.id = e.manager_id
            LEFT JOIN divisions dv ON dv.id = e.division_id
            LEFT JOIN designations dg ON dg.id = e.designation_id
            LEFT JOIN employment_types et ON et.id = e.employment_type_id
            WHERE e.in_hr_ops = TRUE
            ORDER BY e.emp_code
            """, ct);

    public async Task<Dictionary<string, object?>?> EmployeeByIdAsync(int id, CancellationToken ct)
    {
        var rows = await QueryConnAsync(
            """
            SELECT e.*, d.name AS department_name,
                   dv.name AS division_name, dv.code AS division_code,
                   dg.name AS designation_name, dg.id AS designation_id,
                   et.name AS employment_type_name, et.id AS employment_type_id
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN divisions dv ON dv.id = e.division_id
            LEFT JOIN designations dg ON dg.id = e.designation_id
            LEFT JOIN employment_types et ON et.id = e.employment_type_id
            WHERE e.id = @id
            """, ct, ("id", id));
        return rows.FirstOrDefault();
    }

    public Task<List<Dictionary<string, object?>>> DepartmentsAsync(CancellationToken ct) =>
        QueryConnAsync("SELECT id, name FROM departments ORDER BY name", ct);

    public Task<List<Dictionary<string, object?>>> DivisionsAsync(bool activeOnly, CancellationToken ct) =>
        QueryConnAsync(
            activeOnly
                ? """
                  SELECT id, code, name, payroll_type, status, created_at,
                         (SELECT COUNT(*)::int FROM employees WHERE division_id = divisions.id AND status != 'exited') AS employee_count
                  FROM divisions
                  WHERE status = 'active'
                  ORDER BY name
                  """
                : """
                  SELECT id, code, name, payroll_type, status, created_at,
                         (SELECT COUNT(*)::int FROM employees WHERE division_id = divisions.id AND status != 'exited') AS employee_count
                  FROM divisions
                  ORDER BY name
                  """,
            ct);

    public async Task<Dictionary<string, object?>?> DivisionByIdAsync(int id, CancellationToken ct)
    {
        var rows = await QueryConnAsync(
            """
            SELECT id, code, name, payroll_type, status, created_at,
                   (SELECT COUNT(*)::int FROM employees WHERE division_id = divisions.id AND status != 'exited') AS employee_count
            FROM divisions
            WHERE id = @id
            """,
            ct,
            ("id", id));
        return rows.FirstOrDefault();
    }

    public async Task<(Dictionary<string, object?>? Row, string? Error)> CreateDivisionAsync(
        string code, string name, string payrollType, CancellationToken ct)
    {
        code = code.Trim().ToUpperInvariant().Replace(' ', '_');
        name = name.Trim();
        payrollType = string.IsNullOrWhiteSpace(payrollType) ? "wps" : payrollType.Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name))
        {
            return (null, "Code and name are required.");
        }

        if (payrollType is not ("wps" or "bank_transfer"))
        {
            return (null, "Payroll type must be wps or bank_transfer.");
        }

        await using var conn = await OpenAsync(ct);
        try
        {
            await using var cmd = new NpgsqlCommand(
                """
                INSERT INTO divisions (code, name, payroll_type, status)
                VALUES (@code, @name, @payroll, 'active')
                RETURNING id
                """,
                conn);
            cmd.Parameters.AddWithValue("code", code);
            cmd.Parameters.AddWithValue("name", name);
            cmd.Parameters.AddWithValue("payroll", payrollType);
            var id = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
            var row = await DivisionByIdAsync(id, ct);
            return (row, null);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return (null, "A division with this code already exists.");
        }
    }

    public async Task<(Dictionary<string, object?>? Row, string? Error)> UpdateDivisionAsync(
        int id, string? name, string? payrollType, string? status, CancellationToken ct)
    {
        var existing = await DivisionByIdAsync(id, ct);
        if (existing is null)
        {
            return (null, "Division not found.");
        }

        var nextName = string.IsNullOrWhiteSpace(name) ? existing["name"]?.ToString() : name.Trim();
        var nextPayroll = string.IsNullOrWhiteSpace(payrollType)
            ? existing.GetValueOrDefault("payrollType")?.ToString() ?? "wps"
            : payrollType.Trim().ToLowerInvariant();
        var nextStatus = string.IsNullOrWhiteSpace(status)
            ? existing["status"]?.ToString() ?? "active"
            : status.Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(nextName))
        {
            return (null, "Name cannot be empty.");
        }

        if (nextPayroll is not ("wps" or "bank_transfer"))
        {
            return (null, "Payroll type must be wps or bank_transfer.");
        }

        if (nextStatus is not ("active" or "inactive"))
        {
            return (null, "Status must be active or inactive.");
        }

        if (nextStatus == "inactive")
        {
            await using var conn = await OpenAsync(ct);
            var activeEmployees = await ScalarIntAsync(conn,
                """
                SELECT COUNT(*)::int FROM employees
                WHERE division_id = @id AND status != 'exited'
                """,
                ct,
                ("id", id));
            if (activeEmployees > 0)
            {
                return (null, $"Cannot deactivate: {activeEmployees} active employee(s) assigned. Reassign them first.");
            }
        }

        await using var conn2 = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE divisions
            SET name = @name, payroll_type = @payroll, status = @status
            WHERE id = @id
            """,
            conn2);
        cmd.Parameters.AddWithValue("name", nextName);
        cmd.Parameters.AddWithValue("payroll", nextPayroll);
        cmd.Parameters.AddWithValue("status", nextStatus);
        cmd.Parameters.AddWithValue("id", id);
        await cmd.ExecuteNonQueryAsync(ct);

        var row = await DivisionByIdAsync(id, ct);
        return (row, null);
    }

    public async Task<(Dictionary<string, object?>? Employee, string? Error)> CreateEmployeeWithLoginAsync(
        string fullName,
        string email,
        string password,
        string jobTitle,
        string? phone,
        int? departmentId,
        int? divisionId,
        int? designationId,
        int? employmentTypeId,
        int? managerId,
        string? joinDate,
        string status,
        Dictionary<string, object?>? masterData,
        CancellationToken ct)
    {
        fullName = BuildFullName(
            string.IsNullOrWhiteSpace(fullName) ? ComposeNameFromMaster(masterData) : fullName.Trim(),
            masterData);
        email = email.Trim().ToLowerInvariant();
        jobTitle = jobTitle.Trim();
        status = string.IsNullOrWhiteSpace(status) ? "active" : status.Trim().ToLowerInvariant();
        phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();

        if (string.IsNullOrWhiteSpace(fullName) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(jobTitle))
        {
            return (null, "Full name, email, and job title are required.");
        }

        password = password.Trim();
        if (string.IsNullOrWhiteSpace(password) || password.Length < 6)
        {
            return (null, "App login password must be at least 6 characters.");
        }

        if (status is not ("active" or "onboarding"))
        {
            return (null, "Status must be active or onboarding.");
        }

        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        await using (var dup = new NpgsqlCommand(
                         """
                         SELECT
                           EXISTS(SELECT 1 FROM employees WHERE LOWER(email) = @email) AS emp_exists,
                           EXISTS(SELECT 1 FROM users WHERE LOWER(email) = @email) AS user_exists
                         """, conn, tx))
        {
            dup.Parameters.AddWithValue("email", email);
            await using var reader = await dup.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                return (null, "Could not validate email.");
            }

            if (reader.GetBoolean(0) || reader.GetBoolean(1))
            {
                return (null, "An employee or login with this email already exists.");
            }
        }

        if (managerId.HasValue)
        {
            var mgrOk = await ScalarIntTxAsync(conn, tx,
                "SELECT COUNT(*)::int FROM employees WHERE id = @id AND in_hr_ops = TRUE", ct,
                ("id", managerId.Value));
            if (mgrOk == 0)
            {
                return (null, "Selected manager was not found.");
            }
        }

        if (departmentId.HasValue)
        {
            var deptOk = await ScalarIntTxAsync(conn, tx,
                "SELECT COUNT(*)::int FROM departments WHERE id = @id", ct,
                ("id", departmentId.Value));
            if (deptOk == 0)
            {
                return (null, "Selected department was not found.");
            }
        }

        if (divisionId.HasValue)
        {
            var divOk = await ScalarIntTxAsync(conn, tx,
                "SELECT COUNT(*)::int FROM divisions WHERE id = @id AND status = 'active'", ct,
                ("id", divisionId.Value));
            if (divOk == 0)
            {
                return (null, "Selected division was not found or is inactive.");
            }
        }

        if (designationId.HasValue)
        {
            var desOk = await ScalarIntTxAsync(conn, tx,
                "SELECT COUNT(*)::int FROM designations WHERE id = @id AND status = 'active'", ct,
                ("id", designationId.Value));
            if (desOk == 0)
            {
                return (null, "Selected designation was not found or is inactive.");
            }

            var desName = await ScalarStringTxAsync(conn, tx,
                "SELECT name FROM designations WHERE id = @id", ct, ("id", designationId.Value));
            if (!string.IsNullOrWhiteSpace(desName))
            {
                jobTitle = desName;
            }
        }

        if (employmentTypeId.HasValue)
        {
            var etOk = await ScalarIntTxAsync(conn, tx,
                "SELECT COUNT(*)::int FROM employment_types WHERE id = @id AND status = 'active'", ct,
                ("id", employmentTypeId.Value));
            if (etOk == 0)
            {
                return (null, "Selected employment type was not found or is inactive.");
            }
        }

        var nextNum = await ScalarIntTxAsync(conn, tx,
            """
            SELECT COALESCE(MAX(
              CASE WHEN emp_code ~ '^DD-[0-9]+$'
              THEN CAST(SUBSTRING(emp_code FROM 4) AS INTEGER)
              END), 1000) + 1
            FROM employees
            """, ct);
        var empCode = $"DD-{nextNum}";

        DateTime join;
        if (string.IsNullOrWhiteSpace(joinDate))
        {
            join = DateTime.UtcNow.Date;
        }
        else if (!DateOnly.TryParse(joinDate, out var parsedJoin))
        {
            return (null, "Join date is invalid.");
        }
        else
        {
            join = parsedJoin.ToDateTime(TimeOnly.MinValue);
        }

        var hash = PasswordHasher.Hash(password);
        var masterJson = SerializeMasterData(masterData);

        int employeeId;
        await using (var insertEmp = new NpgsqlCommand(
                         """
                         INSERT INTO employees (
                           emp_code, full_name, email, phone, department_id, division_id,
                           designation_id, employment_type_id, job_title,
                           join_date, status, manager_id, in_hr_ops, basic_salary, allowances,
                           master_data
                         )
                         VALUES (
                           @code, @name, @email, @phone, @dept, @div, @desig, @emptype, @title,
                           @join, @status, @mgr, TRUE, 0, 0, @master::jsonb
                         )
                         RETURNING id
                         """, conn, tx))
        {
            insertEmp.Parameters.AddWithValue("code", empCode);
            insertEmp.Parameters.AddWithValue("name", fullName);
            insertEmp.Parameters.AddWithValue("email", email);
            insertEmp.Parameters.AddWithValue("phone", (object?)phone ?? DBNull.Value);
            insertEmp.Parameters.AddWithValue("dept", (object?)departmentId ?? DBNull.Value);
            insertEmp.Parameters.AddWithValue("div", (object?)divisionId ?? DBNull.Value);
            insertEmp.Parameters.AddWithValue("desig", (object?)designationId ?? DBNull.Value);
            insertEmp.Parameters.AddWithValue("emptype", (object?)employmentTypeId ?? DBNull.Value);
            insertEmp.Parameters.AddWithValue("title", jobTitle);
            insertEmp.Parameters.AddWithValue("join", join);
            insertEmp.Parameters.AddWithValue("status", status);
            insertEmp.Parameters.AddWithValue("mgr", (object?)managerId ?? DBNull.Value);
            insertEmp.Parameters.AddWithValue("master", masterJson);
            var idObj = await insertEmp.ExecuteScalarAsync(ct);
            employeeId = Convert.ToInt32(idObj);
        }

        await using (var insertUser = new NpgsqlCommand(
                         """
                         INSERT INTO users (email, password, role, employee_id)
                         VALUES (@email, @hash, 'employee', @eid)
                         """, conn, tx))
        {
            insertUser.Parameters.AddWithValue("email", email);
            insertUser.Parameters.AddWithValue("hash", hash);
            insertUser.Parameters.AddWithValue("eid", employeeId);
            await insertUser.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);

        var created = await EmployeeByIdAsync(employeeId, ct);
        return (created, null);
    }

    public async Task<(bool Ok, string? Error)> ResetEmployeePasswordAsync(
        int employeeId, string password, CancellationToken ct)
    {
        password = password.Trim();
        if (string.IsNullOrWhiteSpace(password) || password.Length < 6)
        {
            return (false, "Password must be at least 6 characters.");
        }

        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE users
            SET password = @hash
            WHERE employee_id = @eid
            """, conn);
        cmd.Parameters.AddWithValue("hash", PasswordHasher.Hash(password));
        cmd.Parameters.AddWithValue("eid", employeeId);
        var rows = await cmd.ExecuteNonQueryAsync(ct);
        return rows == 0
            ? (false, "No app login exists for this employee.")
            : (true, null);
    }

    public Task<List<Dictionary<string, object?>>> DesignationsAsync(bool activeOnly, CancellationToken ct) =>
        QueryConnAsync(
            activeOnly
                ? "SELECT id, name, status, created_at FROM designations WHERE status = 'active' ORDER BY name"
                : "SELECT id, name, status, created_at FROM designations ORDER BY name",
            ct);

    public Task<List<Dictionary<string, object?>>> EmploymentTypesAsync(bool activeOnly, CancellationToken ct) =>
        QueryConnAsync(
            activeOnly
                ? "SELECT id, name, status, created_at FROM employment_types WHERE status = 'active' ORDER BY name"
                : "SELECT id, name, status, created_at FROM employment_types ORDER BY name",
            ct);

    public async Task<(Dictionary<string, object?>? Row, string? Error)> CreateDesignationAsync(string name, CancellationToken ct) =>
        await CreateMasterRowAsync("designations", name, ct);

    public async Task<(Dictionary<string, object?>? Row, string? Error)> CreateEmploymentTypeAsync(string name, CancellationToken ct) =>
        await CreateMasterRowAsync("employment_types", name, ct);

    public Task<(Dictionary<string, object?>? Row, string? Error)> UpdateDesignationAsync(int id, string? name, string? status, CancellationToken ct) =>
        UpdateMasterRowAsync("designations", id, name, status, ct);

    public Task<(Dictionary<string, object?>? Row, string? Error)> UpdateEmploymentTypeAsync(int id, string? name, string? status, CancellationToken ct) =>
        UpdateMasterRowAsync("employment_types", id, name, status, ct);

    public async Task<(int? Id, string? Error)> ResolveDesignationIdAsync(string name, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(name)) return (null, null);
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            "SELECT id FROM designations WHERE LOWER(name) = LOWER(@n) AND status = 'active' LIMIT 1", conn);
        cmd.Parameters.AddWithValue("n", name.Trim());
        var result = await cmd.ExecuteScalarAsync(ct);
        if (result is null) return (null, $"Designation not found: {name.Trim()}");
        return (Convert.ToInt32(result), null);
    }

    public async Task<(int? Id, string? Error)> ResolveEmploymentTypeIdAsync(string name, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(name)) return (null, null);
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            "SELECT id FROM employment_types WHERE LOWER(name) = LOWER(@n) AND status = 'active' LIMIT 1", conn);
        cmd.Parameters.AddWithValue("n", name.Trim());
        var result = await cmd.ExecuteScalarAsync(ct);
        if (result is null) return (null, $"Employment type not found: {name.Trim()}");
        return (Convert.ToInt32(result), null);
    }

    public async Task<(int? Id, string? Error)> ResolveDivisionIdByCodeAsync(string code, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(code)) return (null, null);
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            "SELECT id FROM divisions WHERE UPPER(code) = UPPER(@c) AND status = 'active' LIMIT 1", conn);
        cmd.Parameters.AddWithValue("c", code.Trim());
        var result = await cmd.ExecuteScalarAsync(ct);
        if (result is null) return (null, $"Division code not found: {code.Trim()}");
        return (Convert.ToInt32(result), null);
    }

    public async Task<(int? Id, string? Error)> ResolveDepartmentIdByNameAsync(string name, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(name)) return (null, null);
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            "SELECT id FROM departments WHERE LOWER(name) = LOWER(@n) LIMIT 1", conn);
        cmd.Parameters.AddWithValue("n", name.Trim());
        var result = await cmd.ExecuteScalarAsync(ct);
        if (result is null) return (null, $"Department not found: {name.Trim()}");
        return (Convert.ToInt32(result), null);
    }

    public async Task<(int? Id, string? Error)> ResolveManagerIdByEmailAsync(string email, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email)) return (null, null);
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            "SELECT id FROM employees WHERE LOWER(email) = LOWER(@e) AND in_hr_ops = TRUE LIMIT 1", conn);
        cmd.Parameters.AddWithValue("e", email.Trim());
        var result = await cmd.ExecuteScalarAsync(ct);
        if (result is null) return (null, $"Manager email not found: {email.Trim()}");
        return (Convert.ToInt32(result), null);
    }

    public async Task<(Dictionary<string, object?>? Employee, string? Error)> UpdateEmployeeAsync(
        int id,
        UpdateEmployeeRequest body,
        CancellationToken ct)
    {
        var existing = await EmployeeByIdAsync(id, ct);
        if (existing is null) return (null, "Employee not found.");

        var phone = string.IsNullOrWhiteSpace(body.Phone) ? null : body.Phone.Trim();
        var status = string.IsNullOrWhiteSpace(body.Status)
            ? existing.GetValueOrDefault("status")?.ToString() ?? "active"
            : body.Status.Trim().ToLowerInvariant();

        if (status is not ("active" or "onboarding" or "exited"))
        {
            return (null, "Status must be active, onboarding, or exited.");
        }

        var fullName = BuildFullName(
            ComposeNameFromRequest(body.FirstName, body.MiddleName, body.LastName),
            body.MasterData);
        if (string.IsNullOrWhiteSpace(fullName))
        {
            fullName = existing.GetValueOrDefault("fullName")?.ToString()
                ?? existing.GetValueOrDefault("full_name")?.ToString()
                ?? string.Empty;
        }

        string? jobTitle = string.IsNullOrWhiteSpace(body.JobTitle)
            ? existing.GetValueOrDefault("jobTitle")?.ToString()
              ?? existing.GetValueOrDefault("job_title")?.ToString()
            : body.JobTitle.Trim();

        var departmentId = body.DepartmentId;
        var divisionId = body.DivisionId;
        var designationId = body.DesignationId;
        var employmentTypeId = body.EmploymentTypeId;
        var managerId = body.ManagerId;
        var joinDate = body.JoinDate;

        if (managerId.HasValue)
        {
            await using var conn = await OpenAsync(ct);
            var mgrOk = await ScalarIntAsync(conn,
                "SELECT COUNT(*)::int FROM employees WHERE id = @id AND in_hr_ops = TRUE", ct,
                ("id", managerId.Value));
            if (mgrOk == 0) return (null, "Selected manager was not found.");
        }

        if (departmentId.HasValue)
        {
            await using var conn = await OpenAsync(ct);
            var deptOk = await ScalarIntAsync(conn,
                "SELECT COUNT(*)::int FROM departments WHERE id = @id", ct,
                ("id", departmentId.Value));
            if (deptOk == 0) return (null, "Selected department was not found.");
        }

        if (divisionId.HasValue)
        {
            await using var conn = await OpenAsync(ct);
            var divOk = await ScalarIntAsync(conn,
                "SELECT COUNT(*)::int FROM divisions WHERE id = @id AND status = 'active'", ct,
                ("id", divisionId.Value));
            if (divOk == 0) return (null, "Selected division was not found or is inactive.");
        }

        if (designationId.HasValue)
        {
            await using var conn = await OpenAsync(ct);
            var desOk = await ScalarIntAsync(conn,
                "SELECT COUNT(*)::int FROM designations WHERE id = @id AND status = 'active'", ct,
                ("id", designationId.Value));
            if (desOk == 0) return (null, "Selected designation was not found or is inactive.");

            await using var cmd = new NpgsqlCommand("SELECT name FROM designations WHERE id = @id", conn);
            cmd.Parameters.AddWithValue("id", designationId.Value);
            var desName = await cmd.ExecuteScalarAsync(ct);
            if (desName is not null) jobTitle = desName.ToString();
        }

        if (employmentTypeId.HasValue)
        {
            await using var conn = await OpenAsync(ct);
            var etOk = await ScalarIntAsync(conn,
                "SELECT COUNT(*)::int FROM employment_types WHERE id = @id AND status = 'active'", ct,
                ("id", employmentTypeId.Value));
            if (etOk == 0) return (null, "Selected employment type was not found or is inactive.");
        }

        DateTime? join = null;
        if (!string.IsNullOrWhiteSpace(joinDate))
        {
            if (!DateOnly.TryParse(joinDate, out var parsedJoin))
            {
                return (null, "Join date is invalid.");
            }

            join = parsedJoin.ToDateTime(TimeOnly.MinValue);
        }
        else
        {
            var rawJoin = existing.GetValueOrDefault("joinDate") ?? existing.GetValueOrDefault("join_date");
            if (rawJoin is not null && DateOnly.TryParse(rawJoin.ToString(), out var existingJoin))
            {
                join = existingJoin.ToDateTime(TimeOnly.MinValue);
            }
        }

        await using var conn2 = await OpenAsync(ct);
        var masterJson = SerializeMasterData(body.MasterData);
        await using var update = new NpgsqlCommand(
            """
            UPDATE employees
            SET full_name = @name,
                phone = @phone,
                department_id = @dept,
                division_id = @div,
                designation_id = @desig,
                employment_type_id = @emptype,
                job_title = @title,
                manager_id = @mgr,
                join_date = @join,
                status = @status,
                master_data = @master::jsonb
            WHERE id = @id
            """,
            conn2);
        update.Parameters.AddWithValue("name", fullName);
        update.Parameters.AddWithValue("phone", (object?)phone ?? DBNull.Value);
        update.Parameters.AddWithValue("dept", (object?)departmentId ?? DBNull.Value);
        update.Parameters.AddWithValue("div", (object?)divisionId ?? DBNull.Value);
        update.Parameters.AddWithValue("desig", (object?)designationId ?? DBNull.Value);
        update.Parameters.AddWithValue("emptype", (object?)employmentTypeId ?? DBNull.Value);
        update.Parameters.AddWithValue("title", (object?)jobTitle ?? DBNull.Value);
        update.Parameters.AddWithValue("mgr", (object?)managerId ?? DBNull.Value);
        update.Parameters.AddWithValue("join", (object?)join ?? DBNull.Value);
        update.Parameters.AddWithValue("status", status);
        update.Parameters.AddWithValue("master", masterJson);
        update.Parameters.AddWithValue("id", id);
        await update.ExecuteNonQueryAsync(ct);

        var updated = await EmployeeByIdAsync(id, ct);
        return (updated, null);
    }

    private async Task<(Dictionary<string, object?>? Row, string? Error)> CreateMasterRowAsync(
        string table, string name, CancellationToken ct)
    {
        name = name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return (null, "Name is required.");

        await using var conn = await OpenAsync(ct);
        try
        {
            await using var cmd = new NpgsqlCommand(
                $"INSERT INTO {table} (name, status) VALUES (@name, 'active') RETURNING id", conn);
            cmd.Parameters.AddWithValue("name", name);
            var id = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
            var rows = await QueryConnAsync($"SELECT id, name, status, created_at FROM {table} WHERE id = @id", ct, ("id", id));
            return (rows.FirstOrDefault(), null);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return (null, "This name already exists.");
        }
    }

    private async Task<(Dictionary<string, object?>? Row, string? Error)> UpdateMasterRowAsync(
        string table, int id, string? name, string? status, CancellationToken ct)
    {
        var rows = await QueryConnAsync($"SELECT id, name, status FROM {table} WHERE id = @id", ct, ("id", id));
        var existing = rows.FirstOrDefault();
        if (existing is null) return (null, "Not found.");

        var nextName = string.IsNullOrWhiteSpace(name) ? existing["name"]?.ToString() : name.Trim();
        var nextStatus = string.IsNullOrWhiteSpace(status) ? existing["status"]?.ToString() ?? "active" : status.Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(nextName)) return (null, "Name cannot be empty.");
        if (nextStatus is not ("active" or "inactive")) return (null, "Status must be active or inactive.");

        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            $"UPDATE {table} SET name = @name, status = @status WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("name", nextName);
        cmd.Parameters.AddWithValue("status", nextStatus);
        cmd.Parameters.AddWithValue("id", id);
        await cmd.ExecuteNonQueryAsync(ct);

        var updated = await QueryConnAsync($"SELECT id, name, status, created_at FROM {table} WHERE id = @id", ct, ("id", id));
        return (updated.FirstOrDefault(), null);
    }

    public Task<List<Dictionary<string, object?>>> OnboardingAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT t.*, e.full_name, e.emp_code
            FROM onboarding_tasks t
            JOIN employees e ON e.id = t.employee_id
            ORDER BY t.due_date NULLS LAST, t.id
            """, ct);

    public async Task<Dictionary<string, object?>?> UpdateOnboardingAsync(int id, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE onboarding_tasks
            SET status = @status,
                signed_at = CASE WHEN @status = 'done' THEN NOW() ELSE signed_at END
            WHERE id = @id
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("id", id);
        return await ReadOneAsync(cmd, ct);
    }

    public async Task<List<Dictionary<string, object?>>> AttendanceAsync(int? onlyEmployeeId, CancellationToken ct)
    {
        var sql =
            """
            SELECT a.*, e.full_name, e.emp_code
            FROM attendance a
            JOIN employees e ON e.id = a.employee_id
            WHERE e.in_hr_ops = TRUE
            """;
        if (onlyEmployeeId.HasValue) sql += " AND a.employee_id = @eid";
        sql += " ORDER BY a.work_date DESC, e.full_name LIMIT 100";

        return onlyEmployeeId.HasValue
            ? await QueryConnAsync(sql, ct, ("eid", onlyEmployeeId.Value))
            : await QueryConnAsync(sql, ct);
    }

    public async Task<Dictionary<string, object?>> CreateAttendanceAsync(
        int employeeId, string workDate, string? checkIn, string? checkOut, string? status,
        decimal overtime, string? shiftName, CancellationToken ct)
    {
        var resolved = AttendanceLate.Resolve(checkIn, status);
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO attendance (employee_id, work_date, check_in, check_out, status, late_minutes, overtime_hours, shift_name)
            VALUES (@eid, @wd::date, @cin::time, @cout::time, @status, @late, @ot, @shift)
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("eid", employeeId);
        cmd.Parameters.AddWithValue("wd", workDate);
        cmd.Parameters.AddWithValue("cin", (object?)checkIn ?? DBNull.Value);
        cmd.Parameters.AddWithValue("cout", (object?)checkOut ?? DBNull.Value);
        cmd.Parameters.AddWithValue("status", resolved.Status);
        cmd.Parameters.AddWithValue("late", resolved.LateMinutes);
        cmd.Parameters.AddWithValue("ot", overtime);
        cmd.Parameters.AddWithValue("shift", string.IsNullOrWhiteSpace(shiftName) ? "General" : shiftName.Trim());
        return (await ReadOneAsync(cmd, ct))!;
    }

    public async Task<List<Dictionary<string, object?>>> LeaveAsync(int? onlyEmployeeId, CancellationToken ct)
    {
        var sql =
            """
            SELECT l.*, e.full_name, e.emp_code,
                   CASE
                     WHEN lower(l.status) <> 'pending' THEN l.status
                     WHEN EXISTS (
                       SELECT 1 FROM approvals a
                       WHERE a.request_type = 'leave' AND a.reference_id = l.id
                         AND a.level_no = 1 AND a.status = 'pending'
                     ) THEN 'pending_manager'
                     WHEN EXISTS (
                       SELECT 1 FROM approvals a
                       WHERE a.request_type = 'leave' AND a.reference_id = l.id
                         AND a.status = 'pending'
                     ) THEN 'pending_hr'
                     ELSE l.status
                   END AS workflow_stage
            FROM leave_requests l
            JOIN employees e ON e.id = l.employee_id
            WHERE e.in_hr_ops = TRUE
            """;
        if (onlyEmployeeId.HasValue) sql += " AND l.employee_id = @eid";
        sql += " ORDER BY l.id DESC";

        return onlyEmployeeId.HasValue
            ? await QueryConnAsync(sql, ct, ("eid", onlyEmployeeId.Value))
            : await QueryConnAsync(sql, ct);
    }

    public async Task<List<Dictionary<string, object?>>> LeaveBalancesAsync(int? onlyEmployeeId, CancellationToken ct)
    {
        var sql =
            """
            WITH entitlements AS (
              SELECT * FROM (VALUES
                ('Annual', 30::numeric),
                ('Sick', 15::numeric),
                ('Maternity', 45::numeric),
                ('Unpaid', 0::numeric)
              ) AS t(leave_type, entitlement_days)
            )
            SELECT e.id AS employee_id, e.full_name, e.emp_code,
                   ent.leave_type, ent.entitlement_days,
                   COALESCE(SUM(l.days) FILTER (WHERE l.status = 'approved'), 0)::numeric AS used_days,
                   GREATEST(ent.entitlement_days - COALESCE(SUM(l.days) FILTER (WHERE l.status = 'approved'), 0), 0)::numeric AS remaining_days
            FROM employees e
            CROSS JOIN entitlements ent
            LEFT JOIN leave_requests l
              ON l.employee_id = e.id
             AND lower(l.leave_type) = lower(ent.leave_type)
            WHERE e.in_hr_ops = TRUE
            """;
        if (onlyEmployeeId.HasValue)
        {
            // Self-service: show balances even if HR marked exited mid-offboarding.
            sql += " AND e.id = @eid";
        }
        else
        {
            sql += " AND e.status != 'exited'";
        }
        sql += """
             GROUP BY e.id, e.full_name, e.emp_code, ent.leave_type, ent.entitlement_days
             ORDER BY e.emp_code, ent.leave_type
            """;

        return onlyEmployeeId.HasValue
            ? await QueryConnAsync(sql, ct, ("eid", onlyEmployeeId.Value))
            : await QueryConnAsync(sql, ct);
    }

    public async Task<(Dictionary<string, object?>? Row, string? Error)> CreateLeaveAsync(
        int employeeId, string leaveType, string startDate, string endDate, decimal days, string? reason, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        await using (var dup = new NpgsqlCommand(
                         """
                         SELECT id FROM leave_requests
                         WHERE employee_id = @eid AND lower(status) = 'pending'
                           AND lower(leave_type) = lower(@type)
                           AND start_date = @start::date AND end_date = @end::date
                         LIMIT 1
                         """, conn, (NpgsqlTransaction)tx))
        {
            dup.Parameters.AddWithValue("eid", employeeId);
            dup.Parameters.AddWithValue("type", leaveType);
            dup.Parameters.AddWithValue("start", startDate);
            dup.Parameters.AddWithValue("end", endDate);
            var existing = await dup.ExecuteScalarAsync(ct);
            if (existing is not null and not DBNull)
                return (null, "A pending leave request with the same type and dates already exists.");
        }

        await using var insert = new NpgsqlCommand(
            """
            INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days, reason, status)
            VALUES (@eid, @type, @start::date, @end::date, @days, @reason, 'pending')
            RETURNING *
            """, conn, (NpgsqlTransaction)tx);
        insert.Parameters.AddWithValue("eid", employeeId);
        insert.Parameters.AddWithValue("type", leaveType);
        insert.Parameters.AddWithValue("start", startDate);
        insert.Parameters.AddWithValue("end", endDate);
        insert.Parameters.AddWithValue("days", days);
        insert.Parameters.AddWithValue("reason", (object?)reason ?? DBNull.Value);
        var leave = (await ReadOneAsync(insert, ct))!;

        await using var approval = new NpgsqlCommand(
            """
            INSERT INTO approvals (request_type, reference_id, employee_id, title, level_no, approver_role, status)
            VALUES ('leave', @ref, @eid, @title, 1, 'manager', 'pending')
            """, conn, (NpgsqlTransaction)tx);
        approval.Parameters.AddWithValue("ref", Convert.ToInt32(leave["id"]));
        approval.Parameters.AddWithValue("eid", employeeId);
        approval.Parameters.AddWithValue("title", $"{leaveType} leave request ({days} days)");
        await approval.ExecuteNonQueryAsync(ct);

        var managerId = await ScalarIntNullableAsync(conn,
            "SELECT manager_id FROM employees WHERE id = @id", ct, ("id", employeeId));
        if (managerId is > 0)
        {
            await InsertNotificationAsync(conn, (NpgsqlTransaction)tx, managerId,
                "leave", "Leave approval needed",
                $"{leaveType} leave ({days} days) submitted — awaiting your approval.", null, ct);
        }

        await InsertNotificationAsync(conn, (NpgsqlTransaction)tx, employeeId,
            "leave", "Leave submitted",
            $"Your {leaveType} leave request is pending manager approval.", null, ct);

        await tx.CommitAsync(ct);
        await _email.SendLeaveAppliedAsync(employeeId, leaveType, days, startDate, endDate, managerId, ct);
        return (leave, null);
    }

    public async Task<int> DirectReportsCountAsync(int managerEmployeeId, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        return await ScalarIntAsync(conn,
            """
            SELECT COUNT(*)::int FROM employees
            WHERE manager_id = @mid AND status != 'exited' AND in_hr_ops = TRUE
            """, ct, ("mid", managerEmployeeId));
    }

    public async Task<bool> HasDirectReportsAsync(int managerEmployeeId, CancellationToken ct) =>
        await DirectReportsCountAsync(managerEmployeeId, ct) > 0;

    public Task<List<Dictionary<string, object?>>> TeamPendingLeaveApprovalsAsync(int managerEmployeeId, CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT a.*, e.full_name, e.emp_code,
                   l.leave_type, l.start_date, l.end_date, l.days, l.reason
            FROM approvals a
            JOIN employees e ON e.id = a.employee_id
            JOIN leave_requests l ON l.id = a.reference_id
            WHERE a.request_type = 'leave'
              AND a.status = 'pending'
              AND a.level_no = 1
              AND lower(a.approver_role) = 'manager'
              AND e.manager_id = @mid
              AND e.in_hr_ops = TRUE
            ORDER BY a.created_at DESC
            """, ct, ("mid", managerEmployeeId));

    public async Task<int> TeamPendingApprovalsCountAsync(int managerEmployeeId, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        return await ScalarIntAsync(conn,
            """
            SELECT COUNT(*)::int
            FROM approvals a
            JOIN employees e ON e.id = a.employee_id
            WHERE a.request_type = 'leave'
              AND a.status = 'pending'
              AND a.level_no = 1
              AND lower(a.approver_role) = 'manager'
              AND e.manager_id = @mid
            """, ct, ("mid", managerEmployeeId));
    }

    public async Task<Dictionary<string, object?>?> TeamLeaveApprovalDecisionAsync(
        int approvalId, int managerEmployeeId, string status, string? note, CancellationToken ct)
    {
        if (!await IsApprovalForManagerAsync(approvalId, managerEmployeeId, ct))
            return null;

        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        if (!string.IsNullOrWhiteSpace(note))
        {
            await using var noteCmd = new NpgsqlCommand(
                """
                UPDATE leave_requests SET manager_note = @note
                WHERE id = (
                  SELECT reference_id FROM approvals
                  WHERE id = @aid AND request_type = 'leave'
                )
                """, conn, (NpgsqlTransaction)tx);
            noteCmd.Parameters.AddWithValue("note", note.Trim());
            noteCmd.Parameters.AddWithValue("aid", approvalId);
            await noteCmd.ExecuteNonQueryAsync(ct);
        }

        await using var cmd = new NpgsqlCommand(
            """
            UPDATE approvals
            SET status = @status,
                decision_note = COALESCE(@note, decision_note)
            WHERE id = @id
            RETURNING *
            """, conn, (NpgsqlTransaction)tx);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("note", (object?)note ?? DBNull.Value);
        cmd.Parameters.AddWithValue("id", approvalId);
        var item = await ReadOneAsync(cmd, ct);
        if (item is null)
        {
            await tx.RollbackAsync(ct);
            return null;
        }

        var requestType = Convert.ToString(DictGet(item, "requestType", "request_type")) ?? "";
        var refRaw = DictGet(item, "referenceId", "reference_id");
        var levelRaw = DictGet(item, "levelNo", "level_no");
        var levelNo = levelRaw is null or DBNull ? 1 : Convert.ToInt32(levelRaw);
        var employeeIdRaw = DictGet(item, "employeeId", "employee_id");
        var employeeId = employeeIdRaw is null or DBNull ? 0 : Convert.ToInt32(employeeIdRaw);
        var title = Convert.ToString(DictGet(item, "title")) ?? $"{requestType} approval";

        if (string.Equals(status, "approved", StringComparison.OrdinalIgnoreCase) && refRaw is not null and not DBNull)
        {
            await using var nextCmd = new NpgsqlCommand(
                """
                SELECT level_no, approver_role FROM approval_chains
                WHERE request_type = @rtype AND level_no = @next
                """, conn, (NpgsqlTransaction)tx);
            nextCmd.Parameters.AddWithValue("rtype", requestType);
            nextCmd.Parameters.AddWithValue("next", levelNo + 1);
            await using var nextReader = await nextCmd.ExecuteReaderAsync(ct);
            if (await nextReader.ReadAsync(ct))
            {
                var nextLevel = nextReader.GetInt32(0);
                var nextRole = nextReader.GetString(1);
                await nextReader.DisposeAsync();

                await using var insertNext = new NpgsqlCommand(
                    """
                    INSERT INTO approvals (request_type, reference_id, employee_id, title, level_no, approver_role, status)
                    VALUES (@rtype, @ref, @eid, @title, @lvl, @role, 'pending')
                    """, conn, (NpgsqlTransaction)tx);
                insertNext.Parameters.AddWithValue("rtype", requestType);
                insertNext.Parameters.AddWithValue("ref", Convert.ToInt32(refRaw));
                insertNext.Parameters.AddWithValue("eid", employeeId > 0 ? employeeId : DBNull.Value);
                insertNext.Parameters.AddWithValue("title", $"{title} (L{nextLevel})");
                insertNext.Parameters.AddWithValue("lvl", nextLevel);
                insertNext.Parameters.AddWithValue("role", nextRole);
                await insertNext.ExecuteNonQueryAsync(ct);

                if (employeeId > 0)
                {
                    await InsertNotificationAsync(conn, (NpgsqlTransaction)tx, employeeId,
                        "leave", "Manager approved",
                        "Your leave request was approved by your manager — pending HR final approval.", null, ct);
                }

                await tx.CommitAsync(ct);
                if (employeeId > 0 && refRaw is not null and not DBNull)
                {
                    var leaveInfo = await LeaveInfoAsync(Convert.ToInt32(refRaw), ct);
                    if (leaveInfo is not null)
                    {
                        await _email.SendLeaveApprovedAsync(
                            employeeId, leaveInfo.Value.Type, leaveInfo.Value.Days, "manager", ct);
                    }
                }
                return item;
            }
            await nextReader.DisposeAsync();
        }

        if (refRaw is not null and not DBNull && string.Equals(requestType, "leave", StringComparison.OrdinalIgnoreCase))
        {
            await using var leave = new NpgsqlCommand(
                "UPDATE leave_requests SET status = @status WHERE id = @ref",
                conn, (NpgsqlTransaction)tx);
            leave.Parameters.AddWithValue("status", status);
            leave.Parameters.AddWithValue("ref", Convert.ToInt32(refRaw));
            await leave.ExecuteNonQueryAsync(ct);

            if (employeeId > 0)
            {
                var msg = string.Equals(status, "approved", StringComparison.OrdinalIgnoreCase)
                    ? "Your leave request has been approved."
                    : "Your leave request was rejected.";
                await InsertNotificationAsync(conn, (NpgsqlTransaction)tx, employeeId,
                    "leave", $"Leave {status}", msg, null, ct);
            }
        }

        await tx.CommitAsync(ct);
        if (refRaw is not null and not DBNull
            && string.Equals(requestType, "leave", StringComparison.OrdinalIgnoreCase)
            && employeeId > 0)
        {
            var leaveId = Convert.ToInt32(refRaw);
            var leaveInfo = await LeaveInfoAsync(leaveId, ct);
            if (leaveInfo is not null)
            {
                if (string.Equals(status, "approved", StringComparison.OrdinalIgnoreCase))
                {
                    await _email.SendLeaveApprovedAsync(
                        employeeId, leaveInfo.Value.Type, leaveInfo.Value.Days, "final", ct);
                }
                else if (string.Equals(status, "rejected", StringComparison.OrdinalIgnoreCase))
                {
                    await _email.SendLeaveRejectedAsync(
                        employeeId, leaveInfo.Value.Type, "Manager", ct);
                }
            }
        }
        return item;
    }

    private async Task<int?> ScalarIntNullableAsync(NpgsqlConnection conn, string sql, CancellationToken ct, params (string name, object? value)[] pars)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var (name, value) in pars)
            cmd.Parameters.AddWithValue(name, value ?? DBNull.Value);
        var raw = await cmd.ExecuteScalarAsync(ct);
        if (raw is null or DBNull) return null;
        return Convert.ToInt32(raw);
    }

    private static async Task InsertNotificationAsync(
        NpgsqlConnection conn, NpgsqlTransaction? tx, int? employeeId,
        string category, string title, string message, DateTime? dueDate, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO notifications (employee_id, category, title, message, due_date, is_read)
            VALUES (@eid, @cat, @title, @msg, @due, FALSE)
            """, conn, tx);
        cmd.Parameters.AddWithValue("eid", employeeId is > 0 ? employeeId.Value : DBNull.Value);
        cmd.Parameters.AddWithValue("cat", category);
        cmd.Parameters.AddWithValue("title", title);
        cmd.Parameters.AddWithValue("msg", message);
        cmd.Parameters.AddWithValue("due", dueDate.HasValue ? dueDate.Value.ToString("yyyy-MM-dd") : DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<Dictionary<string, object?>?> UpdateLeaveAsync(int id, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        await using var leaveCmd = new NpgsqlCommand(
            "UPDATE leave_requests SET status = @status WHERE id = @id RETURNING *",
            conn, (NpgsqlTransaction)tx);
        leaveCmd.Parameters.AddWithValue("status", status);
        leaveCmd.Parameters.AddWithValue("id", id);
        var row = await ReadOneAsync(leaveCmd, ct);

        await using var appr = new NpgsqlCommand(
            "UPDATE approvals SET status = @status WHERE request_type = 'leave' AND reference_id = @id",
            conn, (NpgsqlTransaction)tx);
        appr.Parameters.AddWithValue("status", status);
        appr.Parameters.AddWithValue("id", id);
        await appr.ExecuteNonQueryAsync(ct);

        await tx.CommitAsync(ct);
        return row;
    }

    public Task<List<Dictionary<string, object?>>> PayrollAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT p.*, e.full_name, e.emp_code, e.basic_salary AS current_basic,
                   dv.name AS division_name, dv.code AS division_code,
                   COALESCE(p.payment_method, dv.payroll_type, 'wps') AS payment_method
            FROM payslips p
            JOIN employees e ON e.id = p.employee_id
            LEFT JOIN divisions dv ON dv.id = e.division_id
            WHERE e.in_hr_ops = TRUE
            ORDER BY p.generated_at DESC, p.id DESC
            """, ct);

    public Task<List<Dictionary<string, object?>>> DocumentsAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT d.*, e.full_name, e.emp_code
            FROM documents d
            JOIN employees e ON e.id = d.employee_id
            WHERE e.in_hr_ops = TRUE
            ORDER BY d.expiry_date NULLS LAST, d.id DESC
            """, ct);

    public Task<List<Dictionary<string, object?>>> DocumentsForEmployeeAsync(int employeeId, CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT d.*, e.full_name, e.emp_code
            FROM documents d
            JOIN employees e ON e.id = d.employee_id
            WHERE d.employee_id = @eid
            ORDER BY d.expiry_date NULLS LAST, d.id DESC
            """, ct, ("eid", employeeId));

    public async Task<Dictionary<string, object?>?> DocumentByIdAsync(int id, CancellationToken ct)
    {
        var rows = await QueryConnAsync(
            """
            SELECT d.*, e.full_name, e.emp_code
            FROM documents d
            JOIN employees e ON e.id = d.employee_id
            WHERE d.id = @id
            """, ct, ("id", id));
        return rows.FirstOrDefault();
    }

    public async Task<Dictionary<string, object?>> CreateDocumentAsync(
        int employeeId, string docType, string title, string? fileRef,
        string? issueDate, string? expiryDate, string? status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO documents (employee_id, doc_type, title, file_ref, issue_date, expiry_date, status)
            VALUES (@eid, @dtype, @title, @file, @issue::date, @expiry::date, @status)
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("eid", employeeId);
        cmd.Parameters.AddWithValue("dtype", docType);
        cmd.Parameters.AddWithValue("title", title);
        cmd.Parameters.AddWithValue("file", (object?)fileRef ?? DBNull.Value);
        cmd.Parameters.AddWithValue("issue", (object?)issueDate ?? DBNull.Value);
        cmd.Parameters.AddWithValue("expiry", (object?)expiryDate ?? DBNull.Value);
        cmd.Parameters.AddWithValue("status", string.IsNullOrWhiteSpace(status) ? "valid" : status);
        return (await ReadOneAsync(cmd, ct))!;
    }

    public Task<List<Dictionary<string, object?>>> ApprovalsAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT a.*, e.full_name
            FROM approvals a
            LEFT JOIN employees e ON e.id = a.employee_id
            ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END, a.created_at DESC
            """, ct);

    public async Task<Dictionary<string, object?>?> UpdateApprovalAsync(int id, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        await using var cmd = new NpgsqlCommand(
            "UPDATE approvals SET status = @status WHERE id = @id RETURNING *",
            conn, (NpgsqlTransaction)tx);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("id", id);
        var item = await ReadOneAsync(cmd, ct);
        if (item is null)
        {
            await tx.RollbackAsync(ct);
            return null;
        }

        var requestType = Convert.ToString(DictGet(item, "requestType", "request_type")) ?? "";
        var refRaw = DictGet(item, "referenceId", "reference_id");
        var levelRaw = DictGet(item, "levelNo", "level_no");
        var levelNo = levelRaw is null or DBNull ? 1 : Convert.ToInt32(levelRaw);
        var employeeIdRaw = DictGet(item, "employeeId", "employee_id");
        var employeeId = employeeIdRaw is null or DBNull ? 0 : Convert.ToInt32(employeeIdRaw);
        var title = Convert.ToString(DictGet(item, "title")) ?? $"{requestType} approval";

        // Multi-level: on approve, open next chain level instead of finalizing yet
        if (string.Equals(status, "approved", StringComparison.OrdinalIgnoreCase) && refRaw is not null and not DBNull)
        {
            await using var nextCmd = new NpgsqlCommand(
                """
                SELECT level_no, approver_role FROM approval_chains
                WHERE request_type = @rtype AND level_no = @next
                """, conn, (NpgsqlTransaction)tx);
            nextCmd.Parameters.AddWithValue("rtype", requestType);
            nextCmd.Parameters.AddWithValue("next", levelNo + 1);
            await using var nextReader = await nextCmd.ExecuteReaderAsync(ct);
            if (await nextReader.ReadAsync(ct))
            {
                var nextLevel = nextReader.GetInt32(0);
                var nextRole = nextReader.GetString(1);
                await nextReader.DisposeAsync();

                await using var insertNext = new NpgsqlCommand(
                    """
                    INSERT INTO approvals (request_type, reference_id, employee_id, title, level_no, approver_role, status)
                    VALUES (@rtype, @ref, @eid, @title, @lvl, @role, 'pending')
                    """, conn, (NpgsqlTransaction)tx);
                insertNext.Parameters.AddWithValue("rtype", requestType);
                insertNext.Parameters.AddWithValue("ref", Convert.ToInt32(refRaw));
                insertNext.Parameters.AddWithValue("eid", employeeId > 0 ? employeeId : DBNull.Value);
                insertNext.Parameters.AddWithValue("title", $"{title} (L{nextLevel})");
                insertNext.Parameters.AddWithValue("lvl", nextLevel);
                insertNext.Parameters.AddWithValue("role", nextRole);
                await insertNext.ExecuteNonQueryAsync(ct);

                if (string.Equals(requestType, "leave", StringComparison.OrdinalIgnoreCase) && employeeId > 0)
                {
                    await InsertNotificationAsync(conn, (NpgsqlTransaction)tx, employeeId,
                        "leave", "Manager approved",
                        "Your leave request was approved by your manager — pending HR final approval.", null, ct);
                }

                await tx.CommitAsync(ct);
                if (string.Equals(requestType, "leave", StringComparison.OrdinalIgnoreCase)
                    && employeeId > 0 && refRaw is not null and not DBNull)
                {
                    var leaveInfo = await LeaveInfoAsync(Convert.ToInt32(refRaw), ct);
                    if (leaveInfo is not null)
                    {
                        await _email.SendLeaveApprovedAsync(
                            employeeId, leaveInfo.Value.Type, leaveInfo.Value.Days, "manager", ct);
                    }
                }
                return item; // do not sync underlying request until final level
            }
            await nextReader.DisposeAsync();
        }

        if (refRaw is not null and not DBNull)
        {
            var referenceId = Convert.ToInt32(refRaw);
            if (string.Equals(requestType, "leave", StringComparison.OrdinalIgnoreCase))
            {
                await using var leave = new NpgsqlCommand(
                    "UPDATE leave_requests SET status = @status WHERE id = @ref",
                    conn, (NpgsqlTransaction)tx);
                leave.Parameters.AddWithValue("status", status);
                leave.Parameters.AddWithValue("ref", referenceId);
                await leave.ExecuteNonQueryAsync(ct);

                if (employeeId > 0)
                {
                    var msg = string.Equals(status, "approved", StringComparison.OrdinalIgnoreCase)
                        ? "Your leave request has been approved by HR."
                        : string.Equals(status, "rejected", StringComparison.OrdinalIgnoreCase)
                            ? "Your leave request was rejected."
                            : $"Leave request status: {status}";
                    await InsertNotificationAsync(conn, (NpgsqlTransaction)tx, employeeId,
                        "leave", $"Leave {status}", msg, null, ct);
                }
            }
            else if (string.Equals(requestType, "travel", StringComparison.OrdinalIgnoreCase))
            {
                await using var travel = new NpgsqlCommand(
                    """
                    UPDATE travel_requests SET status = @status
                    WHERE id = @ref AND status = 'pending'
                    """, conn, (NpgsqlTransaction)tx);
                travel.Parameters.AddWithValue("status", status);
                travel.Parameters.AddWithValue("ref", referenceId);
                await travel.ExecuteNonQueryAsync(ct);
            }
            else if (string.Equals(requestType, "expense", StringComparison.OrdinalIgnoreCase))
            {
                var expenseStatus = string.Equals(status, "approved", StringComparison.OrdinalIgnoreCase) ? "approved"
                    : string.Equals(status, "rejected", StringComparison.OrdinalIgnoreCase) ? "rejected"
                    : status;
                await using var expense = new NpgsqlCommand(
                    """
                    UPDATE expense_claims SET status = @status
                    WHERE id = @ref AND status = 'pending'
                    """, conn, (NpgsqlTransaction)tx);
                expense.Parameters.AddWithValue("status", expenseStatus);
                expense.Parameters.AddWithValue("ref", referenceId);
                await expense.ExecuteNonQueryAsync(ct);
            }
            else if (string.Equals(requestType, "exit", StringComparison.OrdinalIgnoreCase)
                     && string.Equals(status, "approved", StringComparison.OrdinalIgnoreCase))
            {
                await using var exit = new NpgsqlCommand(
                    "UPDATE exit_cases SET status = 'in_progress' WHERE id = @ref AND status IN ('open', 'in_progress')",
                    conn, (NpgsqlTransaction)tx);
                exit.Parameters.AddWithValue("ref", referenceId);
                await exit.ExecuteNonQueryAsync(ct);
            }
        }

        await tx.CommitAsync(ct);

        if (string.Equals(requestType, "leave", StringComparison.OrdinalIgnoreCase)
            && employeeId > 0 && refRaw is not null and not DBNull)
        {
            var leaveInfo = await LeaveInfoAsync(Convert.ToInt32(refRaw), ct);
            if (leaveInfo is not null)
            {
                if (string.Equals(status, "approved", StringComparison.OrdinalIgnoreCase))
                {
                    await _email.SendLeaveApprovedAsync(
                        employeeId, leaveInfo.Value.Type, leaveInfo.Value.Days, "hr", ct);
                }
                else if (string.Equals(status, "rejected", StringComparison.OrdinalIgnoreCase))
                {
                    await _email.SendLeaveRejectedAsync(
                        employeeId, leaveInfo.Value.Type, "HR", ct);
                }
            }
        }

        return item;
    }

    private async Task<(string Type, decimal Days)?> LeaveInfoAsync(int leaveId, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            "SELECT leave_type, days FROM leave_requests WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", leaveId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return (reader.GetString(0), reader.GetDecimal(1));
    }

    private static object? DictGet(Dictionary<string, object?> row, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (row.TryGetValue(key, out var value) && value is not null and not DBNull)
                return value;
        }
        return null;
    }

    public async Task<List<Dictionary<string, object?>>> NotificationsAsync(int? onlyEmployeeId, CancellationToken ct)
    {
        var sql =
            """
            SELECT n.*, e.full_name
            FROM notifications n
            LEFT JOIN employees e ON e.id = n.employee_id
            WHERE 1=1
            """;
        if (onlyEmployeeId.HasValue) sql += " AND (n.employee_id = @eid OR n.employee_id IS NULL)";
        sql += " ORDER BY n.is_read ASC, n.created_at DESC NULLS LAST, n.id DESC";

        return onlyEmployeeId.HasValue
            ? await QueryConnAsync(sql, ct, ("eid", onlyEmployeeId.Value))
            : await QueryConnAsync(sql, ct);
    }

    public async Task<Dictionary<string, object?>?> MarkNotificationReadAsync(int id, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            "UPDATE notifications SET is_read = TRUE WHERE id = @id RETURNING *", conn);
        cmd.Parameters.AddWithValue("id", id);
        return await ReadOneAsync(cmd, ct);
    }

    public async Task<int> MarkAllNotificationsReadAsync(int? onlyEmployeeId, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        var sql = "UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE";
        if (onlyEmployeeId.HasValue)
        {
            sql += " AND (employee_id = @eid OR employee_id IS NULL)";
        }

        await using var cmd = new NpgsqlCommand(sql, conn);
        if (onlyEmployeeId.HasValue)
        {
            cmd.Parameters.AddWithValue("eid", onlyEmployeeId.Value);
        }

        return await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<object> ReportsAsync(CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        var attendanceByStatus = await QueryAsync(conn,
            "SELECT status, COUNT(*)::int AS total FROM attendance GROUP BY status ORDER BY total DESC", ct);
        var leaveByType = await QueryAsync(conn,
            """
            SELECT leave_type, COUNT(*)::int AS total, COALESCE(SUM(days),0)::float AS days
            FROM leave_requests GROUP BY leave_type ORDER BY total DESC
            """, ct);
        var headcountByDept = await QueryAsync(conn,
            """
            SELECT d.name, COUNT(e.id)::int AS total
            FROM departments d
            LEFT JOIN employees e ON e.department_id = d.id AND e.status != 'exited' AND e.in_hr_ops = TRUE
            GROUP BY d.name ORDER BY total DESC
            """, ct);
        var payrollSummary = await QueryAsync(conn,
            """
            SELECT period_label, COUNT(*)::int AS slips, COALESCE(SUM(net_pay),0)::float AS total_net
            FROM payslips GROUP BY period_label ORDER BY period_label DESC
            """, ct);
        var attritionRows = await QueryAsync(conn,
            """
            SELECT
              COUNT(*) FILTER (WHERE status = 'active')::int AS active,
              COUNT(*) FILTER (WHERE status = 'onboarding')::int AS onboarding,
              COUNT(*) FILTER (WHERE status = 'exited')::int AS exited
            FROM employees WHERE in_hr_ops = TRUE
            """, ct);

        return new
        {
            attendanceByStatus,
            leaveByType,
            headcountByDept,
            payrollSummary,
            attrition = attritionRows.FirstOrDefault() ?? new Dictionary<string, object?>()
        };
    }

    public async Task<object> EssAsync(int employeeId, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        var profileRows = await QueryAsync(conn,
            """
            SELECT e.*, d.name AS department_name
            FROM employees e LEFT JOIN departments d ON d.id = e.department_id
            WHERE e.id = @id
            """, ct, ("id", employeeId));
        var leave = await QueryAsync(conn,
            "SELECT * FROM leave_requests WHERE employee_id = @id ORDER BY id DESC", ct, ("id", employeeId));
        var payslips = await QueryAsync(conn,
            "SELECT * FROM payslips WHERE employee_id = @id ORDER BY id DESC", ct, ("id", employeeId));
        var attendance = await QueryAsync(conn,
            "SELECT * FROM attendance WHERE employee_id = @id ORDER BY work_date DESC LIMIT 30", ct, ("id", employeeId));
        var documents = await QueryAsync(conn,
            "SELECT * FROM documents WHERE employee_id = @id ORDER BY id DESC", ct, ("id", employeeId));

        return new
        {
            profile = profileRows.FirstOrDefault(),
            leave,
            payslips,
            attendance,
            documents
        };
    }

    public async Task<Dictionary<string, object?>?> UpdateEssPhoneAsync(int employeeId, string? phone, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            "UPDATE employees SET phone = @phone WHERE id = @id RETURNING id, full_name, email, phone", conn);
        cmd.Parameters.AddWithValue("phone", (object?)phone ?? DBNull.Value);
        cmd.Parameters.AddWithValue("id", employeeId);
        return await ReadOneAsync(cmd, ct);
    }

    // —— Recruitment / ATS ——
    public Task<List<Dictionary<string, object?>>> JobPostingsAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT j.*,
              (SELECT COUNT(*)::int FROM candidates c WHERE c.job_id = j.id) AS candidate_count
            FROM job_postings j
            ORDER BY j.id DESC
            """, ct);

    public async Task<Dictionary<string, object?>> CreateJobPostingAsync(
        string title, string? department, string? location, string? employmentType,
        string? description, string? status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO job_postings (title, department, location, employment_type, description, status)
            VALUES (@title, @dept, @loc, @etype, @desc, @status)
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("title", title);
        cmd.Parameters.AddWithValue("dept", (object?)department ?? DBNull.Value);
        cmd.Parameters.AddWithValue("loc", (object?)location ?? "Dubai, UAE");
        cmd.Parameters.AddWithValue("etype", (object?)employmentType ?? "Full-time");
        cmd.Parameters.AddWithValue("desc", (object?)description ?? DBNull.Value);
        cmd.Parameters.AddWithValue("status", string.IsNullOrWhiteSpace(status) ? "open" : status);
        return (await ReadOneAsync(cmd, ct))!;
    }

    public async Task<Dictionary<string, object?>?> UpdateJobStatusAsync(int id, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE job_postings
            SET status = @status,
                closed_at = CASE WHEN @status = 'closed' THEN CURRENT_DATE ELSE closed_at END
            WHERE id = @id
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("id", id);
        return await ReadOneAsync(cmd, ct);
    }

    public Task<List<Dictionary<string, object?>>> CandidatesAsync(int? jobId, CancellationToken ct)
    {
        var sql =
            """
            SELECT c.*, j.title AS job_title
            FROM candidates c
            LEFT JOIN job_postings j ON j.id = c.job_id
            """;
        if (jobId.HasValue) sql += " WHERE c.job_id = @jobId";
        sql += " ORDER BY c.id DESC";
        return jobId.HasValue
            ? QueryConnAsync(sql, ct, ("jobId", jobId.Value))
            : QueryConnAsync(sql, ct);
    }

    public async Task<Dictionary<string, object?>> CreateCandidateAsync(
        int? jobId, string fullName, string email, string? phone, string? resumeRef,
        string? source, string? stage, string? notes, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO candidates (job_id, full_name, email, phone, resume_ref, source, stage, notes)
            VALUES (@job, @name, @email, @phone, @resume, @source, @stage, @notes)
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("job", (object?)jobId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("name", fullName);
        cmd.Parameters.AddWithValue("email", email);
        cmd.Parameters.AddWithValue("phone", (object?)phone ?? DBNull.Value);
        cmd.Parameters.AddWithValue("resume", (object?)resumeRef ?? DBNull.Value);
        cmd.Parameters.AddWithValue("source", (object?)source ?? "Careers page");
        cmd.Parameters.AddWithValue("stage", string.IsNullOrWhiteSpace(stage) ? "applied" : stage);
        cmd.Parameters.AddWithValue("notes", (object?)notes ?? DBNull.Value);
        return (await ReadOneAsync(cmd, ct))!;
    }

    public async Task<Dictionary<string, object?>?> UpdateCandidateStageAsync(
        int id, string stage, string? notes, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE candidates
            SET stage = @stage,
                notes = COALESCE(@notes, notes)
            WHERE id = @id
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("stage", stage);
        cmd.Parameters.AddWithValue("notes", (object?)notes ?? DBNull.Value);
        cmd.Parameters.AddWithValue("id", id);
        return await ReadOneAsync(cmd, ct);
    }

    public Task<List<Dictionary<string, object?>>> InterviewsAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT i.*, c.full_name AS candidate_name, c.email AS candidate_email, j.title AS job_title
            FROM interviews i
            JOIN candidates c ON c.id = i.candidate_id
            LEFT JOIN job_postings j ON j.id = c.job_id
            ORDER BY i.scheduled_at DESC
            """, ct);

    public async Task<Dictionary<string, object?>> CreateInterviewAsync(
        int candidateId, string scheduledAt, string? interviewer, string? mode, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO interviews (candidate_id, scheduled_at, interviewer, mode, status)
            VALUES (@cid, @at::timestamptz, @interviewer, @mode, 'scheduled')
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("cid", candidateId);
        cmd.Parameters.AddWithValue("at", scheduledAt);
        cmd.Parameters.AddWithValue("interviewer", (object?)interviewer ?? DBNull.Value);
        cmd.Parameters.AddWithValue("mode", (object?)mode ?? "Online");
        return (await ReadOneAsync(cmd, ct))!;
    }

    public Task<List<Dictionary<string, object?>>> OffersAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT o.*, c.full_name AS candidate_name, c.email AS candidate_email, j.title AS job_title
            FROM offers o
            JOIN candidates c ON c.id = o.candidate_id
            LEFT JOIN job_postings j ON j.id = c.job_id
            ORDER BY o.id DESC
            """, ct);

    public async Task<Dictionary<string, object?>> CreateOfferAsync(
        int candidateId, decimal salary, string? currency, string? joinDate,
        string? status, string? letterRef, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO offers (candidate_id, salary, currency, join_date, status, letter_ref)
            VALUES (@cid, @salary, @currency, @join::date, @status, @letter)
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("cid", candidateId);
        cmd.Parameters.AddWithValue("salary", salary);
        cmd.Parameters.AddWithValue("currency", (object?)currency ?? "AED");
        cmd.Parameters.AddWithValue("join", (object?)joinDate ?? DBNull.Value);
        cmd.Parameters.AddWithValue("status", string.IsNullOrWhiteSpace(status) ? "draft" : status);
        cmd.Parameters.AddWithValue("letter", (object?)letterRef ?? DBNull.Value);
        return (await ReadOneAsync(cmd, ct))!;
    }

    public async Task<Dictionary<string, object?>?> UpdateOfferStatusAsync(int id, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE offers SET status = @status WHERE id = @id RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("id", id);
        return await ReadOneAsync(cmd, ct);
    }

    // —— Exit Management ——
    public Task<List<Dictionary<string, object?>>> ExitCasesAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT x.*, e.full_name, e.emp_code, e.job_title,
              (SELECT COUNT(*)::int FROM exit_checklist c WHERE c.exit_case_id = x.id) AS checklist_total,
              (SELECT COUNT(*)::int FROM exit_checklist c WHERE c.exit_case_id = x.id AND c.status = 'done') AS checklist_done
            FROM exit_cases x
            JOIN employees e ON e.id = x.employee_id
            ORDER BY x.id DESC
            """, ct);

    public async Task<Dictionary<string, object?>> CreateExitCaseAsync(
        int employeeId, string? exitType, string? reason, string? noticeDate,
        string? lastWorkingDate, string? settlementNotes, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        // EOSB estimate — UAE-style simplified: 21 days/yr first 5 years, 30 days/yr after
        string? eosbNote = settlementNotes;
        decimal eosbAmount = 0m;
        decimal serviceYears = 0m;
        await using (var empCmd = new NpgsqlCommand(
                         "SELECT basic_salary, join_date, full_name FROM employees WHERE id = @eid",
                         conn, (NpgsqlTransaction)tx))
        {
            empCmd.Parameters.AddWithValue("eid", employeeId);
            await using var reader = await empCmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                var basic = reader.IsDBNull(0) ? 0m : reader.GetDecimal(0);
                DateTime? join = reader.IsDBNull(1) ? null : reader.GetDateTime(1);
                var end = DateTime.TryParse(lastWorkingDate, out var lwd) ? lwd : DateTime.UtcNow.Date;
                var years = join is null ? 0d : Math.Max(0, (end - join.Value).TotalDays / 365.25);
                serviceYears = Math.Round((decimal)years, 2);
                var first = Math.Min(years, 5d);
                var after = Math.Max(0d, years - 5d);
                eosbAmount = Math.Round((basic / 30m) * 21m * (decimal)first + (basic / 30m) * 30m * (decimal)after, 2);
                var auto = $"EOSB estimate: {eosbAmount:0.##} ({serviceYears:0.00} yrs; 21d×min(5) + 30d×after).";
                eosbNote = string.IsNullOrWhiteSpace(settlementNotes) ? auto : $"{settlementNotes.Trim()} | {auto}";
            }
        }

        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO exit_cases (employee_id, exit_type, reason, notice_date, last_working_date, settlement_notes, status, eosb_amount, service_years)
            VALUES (@eid, @etype, @reason, @notice::date, @lwd::date, @notes, 'open', @eosb, @years)
            RETURNING *
            """, conn, (NpgsqlTransaction)tx);
        cmd.Parameters.AddWithValue("eid", employeeId);
        cmd.Parameters.AddWithValue("etype", string.IsNullOrWhiteSpace(exitType) ? "resignation" : exitType);
        cmd.Parameters.AddWithValue("reason", (object?)reason ?? DBNull.Value);
        cmd.Parameters.AddWithValue("notice", (object?)noticeDate ?? DBNull.Value);
        cmd.Parameters.AddWithValue("lwd", (object?)lastWorkingDate ?? DBNull.Value);
        cmd.Parameters.AddWithValue("notes", (object?)eosbNote ?? DBNull.Value);
        cmd.Parameters.AddWithValue("eosb", eosbAmount);
        cmd.Parameters.AddWithValue("years", serviceYears);
        var created = (await ReadOneAsync(cmd, ct))!;
        var caseId = Convert.ToInt32(created["id"]);

        var defaults = new[]
        {
            ("IT assets returned", "assets"),
            ("Access cards revoked", "access"),
            ("Exit interview completed", "hr"),
            ("Final settlement calculated", "finance"),
            ("Documents archived", "docs"),
        };
        foreach (var (title, cat) in defaults)
        {
            await using var item = new NpgsqlCommand(
                """
                INSERT INTO exit_checklist (exit_case_id, title, category, status)
                VALUES (@xid, @title, @cat, 'pending')
                """, conn, (NpgsqlTransaction)tx);
            item.Parameters.AddWithValue("xid", caseId);
            item.Parameters.AddWithValue("title", title);
            item.Parameters.AddWithValue("cat", cat);
            await item.ExecuteNonQueryAsync(ct);
        }

        await using var approve = new NpgsqlCommand(
            """
            INSERT INTO approvals (request_type, reference_id, employee_id, title, level_no, approver_role, status)
            VALUES ('exit', @ref, @eid, @title, 1, 'manager', 'pending')
            """, conn, (NpgsqlTransaction)tx);
        approve.Parameters.AddWithValue("ref", caseId);
        approve.Parameters.AddWithValue("eid", employeeId);
        approve.Parameters.AddWithValue("title", $"Exit clearance #{caseId}");
        await approve.ExecuteNonQueryAsync(ct);

        await tx.CommitAsync(ct);
        return created;
    }

    public Task<List<Dictionary<string, object?>>> ExitChecklistAsync(int exitCaseId, CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT * FROM exit_checklist WHERE exit_case_id = @xid ORDER BY id
            """, ct, ("xid", exitCaseId));

    public async Task<Dictionary<string, object?>?> UpdateExitChecklistAsync(int id, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE exit_checklist
            SET status = @status,
                completed_at = CASE WHEN @status = 'done' THEN NOW() ELSE NULL END
            WHERE id = @id
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("id", id);
        return await ReadOneAsync(cmd, ct);
    }

    public async Task<Dictionary<string, object?>?> UpdateExitCaseStatusAsync(int id, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        await using var cmd = new NpgsqlCommand(
            """
            UPDATE exit_cases SET status = @status WHERE id = @id RETURNING *
            """, conn, (NpgsqlTransaction)tx);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("id", id);
        var row = await ReadOneAsync(cmd, ct);
        if (row is null)
        {
            await tx.RollbackAsync(ct);
            return null;
        }

        if (string.Equals(status, "completed", StringComparison.OrdinalIgnoreCase))
        {
            var eid = Convert.ToInt32(row["employeeId"] ?? row["employee_id"]);
            await using var emp = new NpgsqlCommand(
                "UPDATE employees SET status = 'exited' WHERE id = @eid", conn, (NpgsqlTransaction)tx);
            emp.Parameters.AddWithValue("eid", eid);
            await emp.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);
        return row;
    }

    // —— Compliance Management ——
    public Task<List<Dictionary<string, object?>>> ComplianceItemsAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT c.*, e.full_name, e.emp_code, e.job_title
            FROM compliance_items c
            LEFT JOIN employees e ON e.id = c.employee_id
            ORDER BY
              CASE c.status
                WHEN 'overdue' THEN 0
                WHEN 'due_soon' THEN 1
                WHEN 'open' THEN 2
                ELSE 3
              END,
              c.due_date NULLS LAST,
              c.id DESC
            """, ct);

    public async Task<Dictionary<string, object?>> CreateComplianceItemAsync(
        int? employeeId, string title, string category, string? dueDate,
        string status, string? notes, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO compliance_items (employee_id, title, category, due_date, status, notes)
            VALUES (@eid, @title, @cat, @due::date, @status, @notes)
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("eid", employeeId is > 0 ? employeeId.Value : DBNull.Value);
        cmd.Parameters.AddWithValue("title", title);
        cmd.Parameters.AddWithValue("cat", category);
        cmd.Parameters.AddWithValue("due", (object?)dueDate ?? DBNull.Value);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("notes", (object?)notes ?? DBNull.Value);
        return (await ReadOneAsync(cmd, ct))!;
    }

    public async Task<Dictionary<string, object?>?> UpdateComplianceStatusAsync(int id, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE compliance_items SET status = @status WHERE id = @id RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("id", id);
        return await ReadOneAsync(cmd, ct);
    }

    // —— Performance Management ——
    public Task<List<Dictionary<string, object?>>> PerformanceGoalsAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT g.*, e.full_name, e.emp_code, e.job_title
            FROM performance_goals g
            JOIN employees e ON e.id = g.employee_id
            ORDER BY
              CASE g.status WHEN 'active' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END,
              g.id DESC
            """, ct);

    public async Task<Dictionary<string, object?>> CreatePerformanceGoalAsync(
        int employeeId, string title, string? kpi, string? targetValue,
        decimal progressPct, string? periodLabel, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO performance_goals (employee_id, title, kpi, target_value, progress_pct, period_label, status)
            VALUES (@eid, @title, @kpi, @target, @progress, @period, @status)
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("eid", employeeId);
        cmd.Parameters.AddWithValue("title", title);
        cmd.Parameters.AddWithValue("kpi", (object?)kpi ?? DBNull.Value);
        cmd.Parameters.AddWithValue("target", (object?)targetValue ?? DBNull.Value);
        cmd.Parameters.AddWithValue("progress", Math.Clamp(progressPct, 0, 100));
        cmd.Parameters.AddWithValue("period", (object?)periodLabel ?? DBNull.Value);
        cmd.Parameters.AddWithValue("status", status);
        return (await ReadOneAsync(cmd, ct))!;
    }

    public async Task<Dictionary<string, object?>?> UpdatePerformanceGoalAsync(
        int id, decimal? progressPct, string? status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE performance_goals
            SET progress_pct = COALESCE(@progress, progress_pct),
                status = COALESCE(@status, status)
            WHERE id = @id
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("progress", progressPct is null ? DBNull.Value : Math.Clamp(progressPct.Value, 0, 100));
        cmd.Parameters.AddWithValue("status", string.IsNullOrWhiteSpace(status) ? DBNull.Value : status);
        cmd.Parameters.AddWithValue("id", id);
        return await ReadOneAsync(cmd, ct);
    }

    public Task<List<Dictionary<string, object?>>> PerformanceReviewsAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT r.*, e.full_name, e.emp_code, e.job_title
            FROM performance_reviews r
            JOIN employees e ON e.id = r.employee_id
            ORDER BY r.review_date DESC NULLS LAST, r.id DESC
            """, ct);

    public async Task<Dictionary<string, object?>> CreatePerformanceReviewAsync(
        int employeeId, string? reviewerName, string reviewType, decimal? rating,
        string? summary, string status, string? reviewDate, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO performance_reviews
              (employee_id, reviewer_name, review_type, rating, summary, status, review_date)
            VALUES (@eid, @reviewer, @rtype, @rating, @summary, @status, COALESCE(@rdate::date, CURRENT_DATE))
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("eid", employeeId);
        cmd.Parameters.AddWithValue("reviewer", (object?)reviewerName ?? DBNull.Value);
        cmd.Parameters.AddWithValue("rtype", reviewType);
        cmd.Parameters.AddWithValue("rating", rating is null ? DBNull.Value : rating.Value);
        cmd.Parameters.AddWithValue("summary", (object?)summary ?? DBNull.Value);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("rdate", (object?)reviewDate ?? DBNull.Value);
        return (await ReadOneAsync(cmd, ct))!;
    }

    public async Task<Dictionary<string, object?>?> UpdatePerformanceReviewStatusAsync(int id, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE performance_reviews SET status = @status WHERE id = @id RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("id", id);
        return await ReadOneAsync(cmd, ct);
    }

    // —— Training & Learning ——
    public Task<List<Dictionary<string, object?>>> CoursesAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT c.*,
              (SELECT COUNT(*)::int FROM course_enrollments e WHERE e.course_id = c.id) AS enrollment_count
            FROM courses c
            ORDER BY CASE c.status WHEN 'active' THEN 0 ELSE 1 END, c.id DESC
            """, ct);

    public async Task<Dictionary<string, object?>> CreateCourseAsync(
        string title, string? category, decimal durationHours, string? description, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO courses (title, category, duration_hours, description, status)
            VALUES (@title, @cat, @hours, @desc, @status)
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("title", title);
        cmd.Parameters.AddWithValue("cat", (object?)category ?? DBNull.Value);
        cmd.Parameters.AddWithValue("hours", durationHours);
        cmd.Parameters.AddWithValue("desc", (object?)description ?? DBNull.Value);
        cmd.Parameters.AddWithValue("status", status);
        return (await ReadOneAsync(cmd, ct))!;
    }

    public async Task<Dictionary<string, object?>?> UpdateCourseStatusAsync(int id, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            "UPDATE courses SET status = @status WHERE id = @id RETURNING *", conn);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("id", id);
        return await ReadOneAsync(cmd, ct);
    }

    public Task<List<Dictionary<string, object?>>> CourseEnrollmentsAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT en.*, c.title AS course_title, c.category AS course_category,
                   e.full_name, e.emp_code
            FROM course_enrollments en
            JOIN courses c ON c.id = en.course_id
            JOIN employees e ON e.id = en.employee_id
            ORDER BY en.id DESC
            """, ct);

    public async Task<Dictionary<string, object?>> CreateEnrollmentAsync(
        int courseId, int employeeId, string? dueDate, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO course_enrollments (course_id, employee_id, due_date, status)
            VALUES (@cid, @eid, @due::date, @status)
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("cid", courseId);
        cmd.Parameters.AddWithValue("eid", employeeId);
        cmd.Parameters.AddWithValue("due", (object?)dueDate ?? DBNull.Value);
        cmd.Parameters.AddWithValue("status", status);
        return (await ReadOneAsync(cmd, ct))!;
    }

    public async Task<Dictionary<string, object?>?> UpdateEnrollmentStatusAsync(int id, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE course_enrollments
            SET status = @status,
                completed_at = CASE WHEN @status = 'completed' THEN CURRENT_DATE ELSE completed_at END
            WHERE id = @id
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("id", id);
        return await ReadOneAsync(cmd, ct);
    }

    public Task<List<Dictionary<string, object?>>> CertificationsAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT cert.*, e.full_name, e.emp_code
            FROM certifications cert
            JOIN employees e ON e.id = cert.employee_id
            ORDER BY cert.expires_on NULLS LAST, cert.id DESC
            """, ct);

    public async Task<Dictionary<string, object?>> CreateCertificationAsync(
        int employeeId, string name, string? issuer, string? issuedOn, string? expiresOn, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO certifications (employee_id, name, issuer, issued_on, expires_on, status)
            VALUES (@eid, @name, @issuer, @issued::date, @expires::date, @status)
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("eid", employeeId);
        cmd.Parameters.AddWithValue("name", name);
        cmd.Parameters.AddWithValue("issuer", (object?)issuer ?? DBNull.Value);
        cmd.Parameters.AddWithValue("issued", (object?)issuedOn ?? DBNull.Value);
        cmd.Parameters.AddWithValue("expires", (object?)expiresOn ?? DBNull.Value);
        cmd.Parameters.AddWithValue("status", status);
        return (await ReadOneAsync(cmd, ct))!;
    }

    public async Task<Dictionary<string, object?>?> UpdateCertificationStatusAsync(int id, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            "UPDATE certifications SET status = @status WHERE id = @id RETURNING *", conn);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("id", id);
        return await ReadOneAsync(cmd, ct);
    }

    // —— Manager Self-Service (MSS) ——
    public async Task<object> MssSummaryAsync(int managerId, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        var teamCount = await ScalarIntAsync(conn,
            """
            SELECT COUNT(*)::int FROM employees
            WHERE manager_id = @mid AND status != 'exited' AND in_hr_ops = TRUE
            """, ct, ("mid", managerId));
        var pendingLeave = await ScalarIntAsync(conn,
            """
            SELECT COUNT(*)::int FROM leave_requests l
            JOIN employees e ON e.id = l.employee_id
            WHERE e.manager_id = @mid AND l.status = 'pending' AND e.in_hr_ops = TRUE
            """, ct, ("mid", managerId));
        var pendingApprovals = await ScalarIntAsync(conn,
            """
            SELECT COUNT(*)::int FROM approvals a
            JOIN employees e ON e.id = a.employee_id
            WHERE e.manager_id = @mid AND a.status = 'pending'
            """, ct, ("mid", managerId));
        var onLeaveToday = await ScalarIntAsync(conn,
            """
            SELECT COUNT(*)::int FROM leave_requests l
            JOIN employees e ON e.id = l.employee_id
            WHERE e.manager_id = @mid
              AND l.status = 'approved'
              AND CURRENT_DATE BETWEEN l.start_date AND l.end_date
            """, ct, ("mid", managerId));

        return new
        {
            managerId,
            teamCount,
            pendingLeave,
            pendingApprovals,
            onLeaveToday
        };
    }

    public Task<List<Dictionary<string, object?>>> MssTeamAsync(int managerId, CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT e.id, e.emp_code, e.full_name, e.email, e.job_title, e.status, e.phone,
                   d.name AS department_name
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            WHERE e.manager_id = @mid AND e.in_hr_ops = TRUE AND e.status != 'exited'
            ORDER BY e.emp_code
            """, ct, ("mid", managerId));

    public Task<List<Dictionary<string, object?>>> MssLeaveAsync(int managerId, CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT l.*, e.full_name, e.emp_code
            FROM leave_requests l
            JOIN employees e ON e.id = l.employee_id
            WHERE e.manager_id = @mid AND e.in_hr_ops = TRUE
            ORDER BY CASE l.status WHEN 'pending' THEN 0 ELSE 1 END, l.start_date DESC
            """, ct, ("mid", managerId));

    public Task<List<Dictionary<string, object?>>> MssAttendanceAsync(int managerId, CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT a.*, e.full_name, e.emp_code
            FROM attendance a
            JOIN employees e ON e.id = a.employee_id
            WHERE e.manager_id = @mid AND e.in_hr_ops = TRUE
            ORDER BY a.work_date DESC, a.id DESC
            LIMIT 40
            """, ct, ("mid", managerId));

    public Task<List<Dictionary<string, object?>>> MssApprovalsAsync(int managerId, CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT a.*, e.full_name, e.emp_code
            FROM approvals a
            JOIN employees e ON e.id = a.employee_id
            WHERE e.manager_id = @mid
            ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END, a.created_at DESC
            """, ct, ("mid", managerId));

    public async Task<bool> IsApprovalForManagerAsync(int approvalId, int managerId, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            SELECT 1
            FROM approvals a
            JOIN employees e ON e.id = a.employee_id
            WHERE a.id = @id AND e.manager_id = @mid
            LIMIT 1
            """, conn);
        cmd.Parameters.AddWithValue("id", approvalId);
        cmd.Parameters.AddWithValue("mid", managerId);
        var result = await cmd.ExecuteScalarAsync(ct);
        return result is not null && result is not DBNull;
    }

    // —— Assets ——
    public Task<List<Dictionary<string, object?>>> AssetsAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT a.*,
              aa.id AS assignment_id,
              aa.employee_id AS assigned_employee_id,
              e.full_name AS assigned_to,
              e.emp_code AS assigned_emp_code,
              aa.assigned_at
            FROM assets a
            LEFT JOIN LATERAL (
              SELECT * FROM asset_assignments x
              WHERE x.asset_id = a.id AND x.returned_at IS NULL
              ORDER BY x.id DESC LIMIT 1
            ) aa ON TRUE
            LEFT JOIN employees e ON e.id = aa.employee_id
            ORDER BY a.asset_tag
            """, ct);

    public Task<List<Dictionary<string, object?>>> AssetAssignmentsAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT aa.*, a.asset_tag, a.name AS asset_name, a.category,
                   e.full_name, e.emp_code
            FROM asset_assignments aa
            JOIN assets a ON a.id = aa.asset_id
            JOIN employees e ON e.id = aa.employee_id
            ORDER BY aa.id DESC
            """, ct);

    public async Task<Dictionary<string, object?>> CreateAssetAsync(
        string assetTag, string name, string category, string? serialNo, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO assets (asset_tag, name, category, serial_no, status)
            VALUES (@tag, @name, @cat, @serial, @status)
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("tag", assetTag);
        cmd.Parameters.AddWithValue("name", name);
        cmd.Parameters.AddWithValue("cat", category);
        cmd.Parameters.AddWithValue("serial", (object?)serialNo ?? DBNull.Value);
        cmd.Parameters.AddWithValue("status", status);
        return (await ReadOneAsync(cmd, ct))!;
    }

    public async Task<Dictionary<string, object?>?> AssignAssetAsync(int assetId, int employeeId, string? notes, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        await using var check = new NpgsqlCommand(
            "SELECT status FROM assets WHERE id = @id FOR UPDATE", conn, (NpgsqlTransaction)tx);
        check.Parameters.AddWithValue("id", assetId);
        var statusObj = await check.ExecuteScalarAsync(ct);
        if (statusObj is null || statusObj is DBNull)
        {
            await tx.RollbackAsync(ct);
            return null;
        }
        if (!string.Equals(Convert.ToString(statusObj), "available", StringComparison.OrdinalIgnoreCase))
        {
            await tx.RollbackAsync(ct);
            return null;
        }

        await using var assign = new NpgsqlCommand(
            """
            INSERT INTO asset_assignments (asset_id, employee_id, notes)
            VALUES (@aid, @eid, @notes)
            RETURNING *
            """, conn, (NpgsqlTransaction)tx);
        assign.Parameters.AddWithValue("aid", assetId);
        assign.Parameters.AddWithValue("eid", employeeId);
        assign.Parameters.AddWithValue("notes", (object?)notes ?? DBNull.Value);
        var row = await ReadOneAsync(assign, ct);

        await using var upd = new NpgsqlCommand(
            "UPDATE assets SET status = 'assigned' WHERE id = @id", conn, (NpgsqlTransaction)tx);
        upd.Parameters.AddWithValue("id", assetId);
        await upd.ExecuteNonQueryAsync(ct);

        await tx.CommitAsync(ct);
        return row;
    }

    public async Task<Dictionary<string, object?>?> ReturnAssetAssignmentAsync(int assignmentId, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        await using var cmd = new NpgsqlCommand(
            """
            UPDATE asset_assignments
            SET returned_at = CURRENT_DATE
            WHERE id = @id AND returned_at IS NULL
            RETURNING *
            """, conn, (NpgsqlTransaction)tx);
        cmd.Parameters.AddWithValue("id", assignmentId);
        var row = await ReadOneAsync(cmd, ct);
        if (row is null)
        {
            await tx.RollbackAsync(ct);
            return null;
        }

        var assetId = Convert.ToInt32(row["assetId"] ?? row["asset_id"]);
        await using var upd = new NpgsqlCommand(
            "UPDATE assets SET status = 'available' WHERE id = @id", conn, (NpgsqlTransaction)tx);
        upd.Parameters.AddWithValue("id", assetId);
        await upd.ExecuteNonQueryAsync(ct);

        await tx.CommitAsync(ct);
        return row;
    }

    // —— Travel & Expense ——
    public Task<List<Dictionary<string, object?>>> TravelRequestsAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT t.*, e.full_name, e.emp_code
            FROM travel_requests t
            JOIN employees e ON e.id = t.employee_id
            ORDER BY CASE t.status WHEN 'pending' THEN 0 ELSE 1 END, t.start_date DESC
            """, ct);

    public async Task<Dictionary<string, object?>> CreateTravelRequestAsync(
        int employeeId, string destination, string? purpose, string startDate, string endDate,
        decimal estimatedCost, string? currency, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO travel_requests
              (employee_id, destination, purpose, start_date, end_date, estimated_cost, currency, status)
            VALUES (@eid, @dest, @purpose, @start::date, @end::date, @cost, @currency, 'pending')
            RETURNING *
            """, conn, (NpgsqlTransaction)tx);
        cmd.Parameters.AddWithValue("eid", employeeId);
        cmd.Parameters.AddWithValue("dest", destination);
        cmd.Parameters.AddWithValue("purpose", (object?)purpose ?? DBNull.Value);
        cmd.Parameters.AddWithValue("start", startDate);
        cmd.Parameters.AddWithValue("end", endDate);
        cmd.Parameters.AddWithValue("cost", estimatedCost);
        cmd.Parameters.AddWithValue("currency", string.IsNullOrWhiteSpace(currency) ? "PKR" : currency);
        var row = (await ReadOneAsync(cmd, ct))!;
        var travelId = Convert.ToInt32(row["id"]);

        await using var approval = new NpgsqlCommand(
            """
            INSERT INTO approvals (request_type, reference_id, employee_id, title, level_no, approver_role, status)
            VALUES ('travel', @ref, @eid, @title, 1, 'manager', 'pending')
            """, conn, (NpgsqlTransaction)tx);
        approval.Parameters.AddWithValue("ref", travelId);
        approval.Parameters.AddWithValue("eid", employeeId);
        approval.Parameters.AddWithValue("title", $"Travel to {destination}");
        await approval.ExecuteNonQueryAsync(ct);

        await tx.CommitAsync(ct);
        return row;
    }

    public async Task<Dictionary<string, object?>?> UpdateTravelStatusAsync(int id, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE travel_requests
            SET status = @status
            WHERE id = @id
              AND (
                (@status IN ('approved', 'rejected', 'cancelled') AND status = 'pending')
                OR (@status = 'pending')
              )
            RETURNING *
            """, conn, (NpgsqlTransaction)tx);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("id", id);
        var row = await ReadOneAsync(cmd, ct);
        if (row is null)
        {
            await tx.RollbackAsync(ct);
            return null;
        }

        await using var appr = new NpgsqlCommand(
            "UPDATE approvals SET status = @status WHERE request_type = 'travel' AND reference_id = @id",
            conn, (NpgsqlTransaction)tx);
        appr.Parameters.AddWithValue("status", status);
        appr.Parameters.AddWithValue("id", id);
        await appr.ExecuteNonQueryAsync(ct);

        await tx.CommitAsync(ct);
        return row;
    }

    public Task<List<Dictionary<string, object?>>> ExpenseClaimsAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT x.*, e.full_name, e.emp_code
            FROM expense_claims x
            JOIN employees e ON e.id = x.employee_id
            ORDER BY CASE x.status WHEN 'pending' THEN 0 ELSE 1 END, x.expense_date DESC
            """, ct);

    public async Task<Dictionary<string, object?>> CreateExpenseClaimAsync(
        int employeeId, string title, string? category, decimal amount, string? currency,
        string? expenseDate, string? notes, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO expense_claims
              (employee_id, title, category, amount, currency, expense_date, notes, status)
            VALUES (@eid, @title, @cat, @amount, @currency, COALESCE(@edate::date, CURRENT_DATE), @notes, 'pending')
            RETURNING *
            """, conn, (NpgsqlTransaction)tx);
        cmd.Parameters.AddWithValue("eid", employeeId);
        cmd.Parameters.AddWithValue("title", title);
        cmd.Parameters.AddWithValue("cat", string.IsNullOrWhiteSpace(category) ? "general" : category);
        cmd.Parameters.AddWithValue("amount", amount);
        cmd.Parameters.AddWithValue("currency", string.IsNullOrWhiteSpace(currency) ? "PKR" : currency);
        cmd.Parameters.AddWithValue("edate", (object?)expenseDate ?? DBNull.Value);
        cmd.Parameters.AddWithValue("notes", (object?)notes ?? DBNull.Value);
        var row = (await ReadOneAsync(cmd, ct))!;
        var expenseId = Convert.ToInt32(row["id"]);

        await using var approval = new NpgsqlCommand(
            """
            INSERT INTO approvals (request_type, reference_id, employee_id, title, level_no, approver_role, status)
            VALUES ('expense', @ref, @eid, @title, 1, 'manager', 'pending')
            """, conn, (NpgsqlTransaction)tx);
        approval.Parameters.AddWithValue("ref", expenseId);
        approval.Parameters.AddWithValue("eid", employeeId);
        approval.Parameters.AddWithValue("title", $"Expense: {title}");
        await approval.ExecuteNonQueryAsync(ct);

        await tx.CommitAsync(ct);
        return row;
    }

    public async Task<Dictionary<string, object?>?> UpdateExpenseStatusAsync(int id, string status, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            UPDATE expense_claims
            SET status = @status
            WHERE id = @id
              AND (
                (@status IN ('approved', 'rejected') AND status = 'pending')
                OR (@status = 'paid' AND status IN ('pending', 'approved'))
              )
            RETURNING *
            """, conn, (NpgsqlTransaction)tx);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("id", id);
        var row = await ReadOneAsync(cmd, ct);
        if (row is null)
        {
            await tx.RollbackAsync(ct);
            return null;
        }

        var approvalStatus = string.Equals(status, "paid", StringComparison.OrdinalIgnoreCase) ? "approved" : status;
        await using var appr = new NpgsqlCommand(
            "UPDATE approvals SET status = @status WHERE request_type = 'expense' AND reference_id = @id",
            conn, (NpgsqlTransaction)tx);
        appr.Parameters.AddWithValue("status", approvalStatus);
        appr.Parameters.AddWithValue("id", id);
        await appr.ExecuteNonQueryAsync(ct);

        await tx.CommitAsync(ct);
        return row;
    }

    // —— Deep features ——
    public Task<List<Dictionary<string, object?>>> OrgChartAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT e.id, e.emp_code, e.full_name, e.job_title, e.manager_id, e.status,
                   d.name AS department_name, m.full_name AS manager_name
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN employees m ON m.id = e.manager_id
            WHERE e.in_hr_ops = TRUE AND e.status != 'exited'
            ORDER BY COALESCE(e.manager_id, 0), e.emp_code
            """, ct);

    public Task<List<Dictionary<string, object?>>> EmploymentHistoryAsync(int employeeId, CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT * FROM employment_history
            WHERE employee_id = @eid
            ORDER BY start_date DESC, id DESC
            """, ct, ("eid", employeeId));

    public async Task<Dictionary<string, object?>> CreateEmploymentHistoryAsync(
        int employeeId, string jobTitle, string? departmentName, string? managerName,
        string startDate, string? endDate, string? notes, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO employment_history (employee_id, job_title, department_name, manager_name, start_date, end_date, notes)
            VALUES (@eid, @title, @dept, @mgr, @start::date, @end::date, @notes)
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("eid", employeeId);
        cmd.Parameters.AddWithValue("title", jobTitle);
        cmd.Parameters.AddWithValue("dept", (object?)departmentName ?? DBNull.Value);
        cmd.Parameters.AddWithValue("mgr", (object?)managerName ?? DBNull.Value);
        cmd.Parameters.AddWithValue("start", startDate);
        cmd.Parameters.AddWithValue("end", (object?)endDate ?? DBNull.Value);
        cmd.Parameters.AddWithValue("notes", (object?)notes ?? DBNull.Value);
        return (await ReadOneAsync(cmd, ct))!;
    }

    public Task<List<Dictionary<string, object?>>> SkillsAsync(CancellationToken ct) =>
        QueryConnAsync("SELECT * FROM skills ORDER BY category, name", ct);

    public Task<List<Dictionary<string, object?>>> EmployeeSkillsAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT es.*, s.name AS skill_name, s.category, e.full_name, e.emp_code
            FROM employee_skills es
            JOIN skills s ON s.id = es.skill_id
            JOIN employees e ON e.id = es.employee_id
            ORDER BY e.emp_code, s.name
            """, ct);

    public async Task AssignEmployeeSkillAsync(int employeeId, int skillId, string? level, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO employee_skills (employee_id, skill_id, level)
            VALUES (@eid, @sid, @lvl)
            ON CONFLICT (employee_id, skill_id) DO UPDATE SET level = EXCLUDED.level
            """, conn);
        cmd.Parameters.AddWithValue("eid", employeeId);
        cmd.Parameters.AddWithValue("sid", skillId);
        cmd.Parameters.AddWithValue("lvl", string.IsNullOrWhiteSpace(level) ? "intermediate" : level.Trim());
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public Task<List<Dictionary<string, object?>>> TrainingCalendarAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT id, title, category, scheduled_start, scheduled_end, status, duration_hours
            FROM courses
            WHERE scheduled_start IS NOT NULL
            ORDER BY scheduled_start
            """, ct);

    public async Task<object> RunPayrollAsync(string periodLabel, decimal otRatePerHour, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var created = new List<Dictionary<string, object?>>();
        var wpsCount = 0;
        var bankCount = 0;
        await using (var emps = new NpgsqlCommand(
                         """
                         SELECT e.id, e.basic_salary, e.allowances,
                                COALESCE(dv.payroll_type, 'wps') AS payroll_type
                         FROM employees e
                         LEFT JOIN divisions dv ON dv.id = e.division_id
                         WHERE e.in_hr_ops = TRUE AND e.status = 'active'
                         """, conn, (NpgsqlTransaction)tx))
        await using (var reader = await emps.ExecuteReaderAsync(ct))
        {
            var list = new List<(int Id, decimal Basic, decimal Allow, string PayrollType)>();
            while (await reader.ReadAsync(ct))
            {
                list.Add((
                    reader.GetInt32(0),
                    reader.IsDBNull(1) ? 0m : reader.GetDecimal(1),
                    reader.IsDBNull(2) ? 0m : reader.GetDecimal(2),
                    reader.IsDBNull(3) ? "wps" : reader.GetString(3)));
            }
            await reader.DisposeAsync();

            var stamp = DateTime.UtcNow.ToString("yyyyMMddHHmm");
            var wpsBatch = $"WPS-{periodLabel.Replace(' ', '-')}-{stamp}";
            var bankBatch = $"BT-{periodLabel.Replace(' ', '-')}-{stamp}";
            foreach (var emp in list)
            {
                await using var exists = new NpgsqlCommand(
                    "SELECT COUNT(*)::int FROM payslips WHERE employee_id = @eid AND period_label = @p",
                    conn, (NpgsqlTransaction)tx);
                exists.Parameters.AddWithValue("eid", emp.Id);
                exists.Parameters.AddWithValue("p", periodLabel);
                var count = Convert.ToInt32(await exists.ExecuteScalarAsync(ct));
                if (count > 0) continue;

                await using var otCmd = new NpgsqlCommand(
                    """
                    SELECT COALESCE(SUM(overtime_hours),0)::numeric FROM attendance
                    WHERE employee_id = @eid
                      AND to_char(work_date, 'YYYY-MM') = left(@p, 7)
                    """, conn, (NpgsqlTransaction)tx);
                otCmd.Parameters.AddWithValue("eid", emp.Id);
                otCmd.Parameters.AddWithValue("p", periodLabel);
                var otHours = Convert.ToDecimal(await otCmd.ExecuteScalarAsync(ct) ?? 0m);
                var otPay = Math.Round(otHours * otRatePerHour, 2);
                var deductions = 0m;
                var net = emp.Basic + emp.Allow + otPay - deductions;

                var isBank = string.Equals(emp.PayrollType, "bank_transfer", StringComparison.OrdinalIgnoreCase);
                var paymentMethod = isBank ? "bank_transfer" : "wps";
                var batch = isBank ? bankBatch : wpsBatch;
                var prefix = isBank ? "BT" : "WPS";
                if (isBank) bankCount++; else wpsCount++;

                await using var insert = new NpgsqlCommand(
                    """
                    INSERT INTO payslips (employee_id, period_label, basic_salary, overtime_pay, allowances, deductions, net_pay, wps_ref, payment_method)
                    VALUES (@eid, @p, @basic, @ot, @allow, @ded, @net, @ref, @pm)
                    RETURNING *
                    """, conn, (NpgsqlTransaction)tx);
                insert.Parameters.AddWithValue("eid", emp.Id);
                insert.Parameters.AddWithValue("p", periodLabel);
                insert.Parameters.AddWithValue("basic", emp.Basic);
                insert.Parameters.AddWithValue("ot", otPay);
                insert.Parameters.AddWithValue("allow", emp.Allow);
                insert.Parameters.AddWithValue("ded", deductions);
                insert.Parameters.AddWithValue("net", net);
                insert.Parameters.AddWithValue("ref", $"{prefix}-{batch}-{emp.Id}");
                insert.Parameters.AddWithValue("pm", paymentMethod);
                created.Add((await ReadOneAsync(insert, ct))!);
            }

            await tx.CommitAsync(ct);
            return new
            {
                periodLabel,
                created = created.Count,
                wpsCount,
                bankTransferCount = bankCount,
                wpsBatch,
                bankBatch,
                slips = created
            };
        }
    }

    public Task<List<Dictionary<string, object?>>> PayrollSummaryAsync(string periodLabel, CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT dv.id AS division_id, dv.code AS division_code, dv.name AS division_name,
                   COALESCE(dv.payroll_type, 'wps') AS payroll_type,
                   COUNT(p.id)::int AS slip_count,
                   COALESCE(SUM(p.net_pay), 0)::float AS total_net
            FROM payslips p
            JOIN employees e ON e.id = p.employee_id
            LEFT JOIN divisions dv ON dv.id = e.division_id
            WHERE p.period_label = @p AND e.in_hr_ops = TRUE
            GROUP BY dv.id, dv.code, dv.name, dv.payroll_type
            ORDER BY dv.code NULLS LAST
            """, ct, ("p", periodLabel));

    public Task<(string FileName, string Csv)> BuildWpsCsvAsync(string? periodLabel, CancellationToken ct) =>
        BuildPayrollCsvAsync(periodLabel, "wps", "WPS", ct);

    public Task<(string FileName, string Csv)> BuildBankTransferCsvAsync(string? periodLabel, CancellationToken ct) =>
        BuildPayrollCsvAsync(periodLabel, "bank_transfer", "BankTransfer", ct);

    private async Task<(string FileName, string Csv)> BuildPayrollCsvAsync(
        string? periodLabel, string paymentMethod, string filePrefix, CancellationToken ct)
    {
        var sql =
            """
            SELECT e.emp_code, e.full_name, dv.name AS division_name,
                   p.period_label, p.basic_salary, p.overtime_pay,
                   p.allowances, p.deductions, p.net_pay, p.wps_ref,
                   COALESCE(p.payment_method, dv.payroll_type, 'wps') AS payment_method
            FROM payslips p
            JOIN employees e ON e.id = p.employee_id
            LEFT JOIN divisions dv ON dv.id = e.division_id
            WHERE COALESCE(p.payment_method, dv.payroll_type, 'wps') = @pm
            """;
        List<Dictionary<string, object?>> rows;
        if (!string.IsNullOrWhiteSpace(periodLabel))
        {
            sql += " AND p.period_label = @p ORDER BY e.emp_code";
            rows = await QueryConnAsync(sql, ct, ("pm", paymentMethod), ("p", periodLabel!));
        }
        else
        {
            sql += " ORDER BY p.id DESC LIMIT 200";
            rows = await QueryConnAsync(sql, ct, ("pm", paymentMethod));
        }

        var sb = new System.Text.StringBuilder();
        var refHeader = paymentMethod == "bank_transfer" ? "PaymentRef" : "WpsRef";
        sb.AppendLine($"EmpCode,Employee,Division,Period,Basic,Overtime,Allowances,Deductions,Net,{refHeader},Method");
        foreach (var r in rows)
        {
            string C(params string[] keys) => Convert.ToString(DictGet(r, keys))?.Replace(',', ' ') ?? "";
            sb.AppendLine(string.Join(',',
                C("empCode", "emp_code"),
                C("fullName", "full_name"),
                C("divisionName", "division_name"),
                C("periodLabel", "period_label"),
                C("basicSalary", "basic_salary"),
                C("overtimePay", "overtime_pay"),
                C("allowances"),
                C("deductions"),
                C("netPay", "net_pay"),
                C("wpsRef", "wps_ref"),
                paymentMethod));
        }

        var name = $"{filePrefix}_{(string.IsNullOrWhiteSpace(periodLabel) ? "export" : periodLabel)}.csv";
        return (name, sb.ToString());
    }

    public async Task<object> GenerateNotificationsAsync(CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        var inserted = 0;
        var pending = new List<(int? Eid, string Cat, string Title, string Msg, DateTime? Due)>();

        await using (var empCmd = new NpgsqlCommand(
                         """
                         SELECT id, full_name, dob, probation_end, contract_end, visa_expiry
                         FROM employees WHERE in_hr_ops = TRUE AND status != 'exited'
                         """, conn))
        await using (var reader = await empCmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var id = reader.GetInt32(0);
                var name = reader.GetString(1);
                DateTime? dob = reader.IsDBNull(2) ? null : reader.GetDateTime(2);
                DateTime? probation = reader.IsDBNull(3) ? null : reader.GetDateTime(3);
                DateTime? contract = reader.IsDBNull(4) ? null : reader.GetDateTime(4);
                DateTime? visa = reader.IsDBNull(5) ? null : reader.GetDateTime(5);

                if (dob is not null)
                {
                    var day = Math.Min(dob.Value.Day, DateTime.DaysInMonth(DateTime.UtcNow.Year, dob.Value.Month));
                    var next = new DateTime(DateTime.UtcNow.Year, dob.Value.Month, day);
                    if (next < DateTime.UtcNow.Date) next = next.AddYears(1);
                    if ((next - DateTime.UtcNow.Date).TotalDays <= 30)
                        pending.Add((id, "birthday", $"Birthday · {name}", $"Upcoming birthday on {next:yyyy-MM-dd}", next));
                }
                if (probation is not null && (probation.Value.Date - DateTime.UtcNow.Date).TotalDays is >= 0 and <= 45)
                    pending.Add((id, "probation", $"Probation ending · {name}", "Probation completion approaching.", probation));
                if (contract is not null && (contract.Value.Date - DateTime.UtcNow.Date).TotalDays is >= 0 and <= 60)
                    pending.Add((id, "contract", $"Contract expiry · {name}", "Employment contract renews soon.", contract));
                if (visa is not null && (visa.Value.Date - DateTime.UtcNow.Date).TotalDays is >= 0 and <= 60)
                    pending.Add((id, "visa", $"Visa renewal · {name}", "Residence visa renewal window.", visa));
            }
        }

        await using (var train = new NpgsqlCommand(
                         """
                         SELECT en.employee_id, e.full_name, c.title, en.due_date
                         FROM course_enrollments en
                         JOIN employees e ON e.id = en.employee_id
                         JOIN courses c ON c.id = en.course_id
                         WHERE en.due_date IS NOT NULL AND en.status IN ('assigned','in_progress')
                           AND en.due_date <= CURRENT_DATE + 21
                         """, conn))
        await using (var reader = await train.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                pending.Add((reader.GetInt32(0), "training", $"Training due · {reader.GetString(2)}",
                    $"{reader.GetString(1)} has training due.", reader.GetDateTime(3)));
            }
        }

        foreach (var p in pending)
        {
            await using var check = new NpgsqlCommand(
                """
                SELECT COUNT(*)::int FROM notifications
                WHERE COALESCE(employee_id,0) = COALESCE(@eid,0)
                  AND category = @cat AND title = @title
                  AND COALESCE(due_date, DATE '1900-01-01') = COALESCE(@due::date, DATE '1900-01-01')
                """, conn);
            check.Parameters.AddWithValue("eid", p.Eid is > 0 ? p.Eid.Value : DBNull.Value);
            check.Parameters.AddWithValue("cat", p.Cat);
            check.Parameters.AddWithValue("title", p.Title);
            check.Parameters.AddWithValue("due", p.Due.HasValue ? p.Due.Value.ToString("yyyy-MM-dd") : DBNull.Value);
            if (Convert.ToInt32(await check.ExecuteScalarAsync(ct)) > 0) continue;

            await using var cmd = new NpgsqlCommand(
                """
                INSERT INTO notifications (employee_id, category, title, message, due_date, is_read)
                VALUES (@eid, @cat, @title, @msg, @due::date, FALSE)
                """, conn);
            cmd.Parameters.AddWithValue("eid", p.Eid is > 0 ? p.Eid.Value : DBNull.Value);
            cmd.Parameters.AddWithValue("cat", p.Cat);
            cmd.Parameters.AddWithValue("title", p.Title);
            cmd.Parameters.AddWithValue("msg", p.Msg);
            cmd.Parameters.AddWithValue("due", p.Due.HasValue ? p.Due.Value.ToString("yyyy-MM-dd") : DBNull.Value);
            inserted += await cmd.ExecuteNonQueryAsync(ct);
        }

        return new { inserted };
    }

    public Task<List<Dictionary<string, object?>>> AuditLogsAsync(CancellationToken ct) =>
        QueryConnAsync(
            """
            SELECT * FROM audit_logs
            ORDER BY id DESC
            LIMIT 200
            """, ct);

    public async Task WriteAuditAsync(string? actorEmail, string? actorRole, string action,
        string? entityType, int? entityId, string? detail, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO audit_logs (actor_email, actor_role, action, entity_type, entity_id, detail)
            VALUES (@email, @role, @action, @etype, @eid, @detail)
            """, conn);
        cmd.Parameters.AddWithValue("email", (object?)actorEmail ?? DBNull.Value);
        cmd.Parameters.AddWithValue("role", (object?)actorRole ?? DBNull.Value);
        cmd.Parameters.AddWithValue("action", action);
        cmd.Parameters.AddWithValue("etype", (object?)entityType ?? DBNull.Value);
        cmd.Parameters.AddWithValue("eid", entityId is > 0 ? entityId.Value : DBNull.Value);
        cmd.Parameters.AddWithValue("detail", (object?)detail ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<object> ScreenResumeAsync(int candidateId, CancellationToken ct)
    {
        var rows = await QueryConnAsync(
            """
            SELECT c.*, j.title AS job_title, j.description AS job_description
            FROM candidates c
            LEFT JOIN job_postings j ON j.id = c.job_id
            WHERE c.id = @id
            """, ct, ("id", candidateId));
        var c = rows.FirstOrDefault() ?? throw new InvalidOperationException("candidate not found");
        var resume = Convert.ToString(DictGet(c, "resumeRef", "resume_ref")) ?? "";
        var notes = Convert.ToString(DictGet(c, "notes")) ?? "";
        var job = Convert.ToString(DictGet(c, "jobTitle", "job_title")) ?? "";
        var blob = $"{resume} {notes} {job}".ToLowerInvariant();
        var keywords = new[] { "c#", ".net", "flutter", "hr", "payroll", "uae", "visa", "react", "sql", "manager" };
        var hits = keywords.Where(k => blob.Contains(k)).ToList();
        var score = Math.Min(100, hits.Count * 12 + (string.IsNullOrWhiteSpace(resume) ? 0 : 20));
        var recommendation = score >= 60 ? "advance_to_interview" : score >= 30 ? "manual_review" : "reject_or_hold";

        if (score >= 60)
        {
            await using var conn = await OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(
                "UPDATE candidates SET stage = 'screening', notes = COALESCE(notes,'') || @n WHERE id = @id AND stage = 'applied'",
                conn);
            cmd.Parameters.AddWithValue("id", candidateId);
            cmd.Parameters.AddWithValue("n", $" | Auto-screen score {score}: {string.Join(',', hits)}");
            await cmd.ExecuteNonQueryAsync(ct);
        }

        return new { candidateId, score, hits, recommendation, resumeRef = resume };
    }

    public async Task<object> ReportsDashboardAsync(CancellationToken ct)
    {
        var baseReports = await ReportsAsync(ct);
        await using var conn = await OpenAsync(ct);
        var pendingApprovals = await ScalarIntAsync(conn, "SELECT COUNT(*)::int FROM approvals WHERE status = 'pending'", ct);
        var openJobs = await ScalarIntAsync(conn, "SELECT COUNT(*)::int FROM job_postings WHERE status = 'open'", ct);
        var openExits = await ScalarIntAsync(conn, "SELECT COUNT(*)::int FROM exit_cases WHERE status IN ('open','in_progress')", ct);
        var expiringVisa = await ScalarIntAsync(conn,
            "SELECT COUNT(*)::int FROM employees WHERE in_hr_ops AND status != 'exited' AND visa_expiry IS NOT NULL AND visa_expiry <= CURRENT_DATE + 60", ct);

        return new
        {
            core = baseReports,
            widgets = new
            {
                pendingApprovals,
                openJobs,
                openExits,
                expiringVisa,
                pendingCertificates = await ScalarIntAsync(conn,
                    "SELECT COUNT(*)::int FROM certificate_requests WHERE status = 'pending'", ct)
            }
        };
    }

    // —— Certificates (Phase 6) ——
    public async Task<Dictionary<string, object?>?> CertificatePrefillAsync(int employeeId, CancellationToken ct)
    {
        var rows = await QueryConnAsync(
            """
            SELECT e.id AS employee_id, e.emp_code, e.full_name, e.basic_salary, e.join_date,
                   e.job_title, dg.name AS designation_name, d.name AS department_name,
                   dv.name AS division_name
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN divisions dv ON dv.id = e.division_id
            LEFT JOIN designations dg ON dg.id = e.designation_id
            WHERE e.id = @id AND e.in_hr_ops = TRUE
            """, ct, ("id", employeeId));
        return rows.FirstOrDefault();
    }

    public Task<List<Dictionary<string, object?>>> CertificatesAsync(int? onlyEmployeeId, CancellationToken ct)
    {
        var sql = """
            SELECT cr.*,
                   e.full_name AS employee_name, e.emp_code AS employee_code
            FROM certificate_requests cr
            JOIN employees e ON e.id = cr.employee_id
            WHERE e.in_hr_ops = TRUE
            """;
        if (onlyEmployeeId is > 0)
            sql += " AND cr.employee_id = @eid";
        sql += " ORDER BY cr.created_at DESC, cr.id DESC";
        return onlyEmployeeId is > 0
            ? QueryConnAsync(sql, ct, ("eid", onlyEmployeeId.Value))
            : QueryConnAsync(sql, ct);
    }

    public async Task<Dictionary<string, object?>?> CertificateByIdAsync(int id, CancellationToken ct)
    {
        var rows = await QueryConnAsync(
            """
            SELECT cr.*, e.full_name AS employee_name, e.emp_code AS employee_code
            FROM certificate_requests cr
            JOIN employees e ON e.id = cr.employee_id
            WHERE cr.id = @id
            """, ct, ("id", id));
        return rows.FirstOrDefault();
    }

    public async Task<(Dictionary<string, object?>? Row, string? Error)> CreateCertificateAsync(
        int employeeId, string certificateType, string? purpose, string? bankName, string? travelDestination,
        CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        await using (var dup = new NpgsqlCommand(
                         """
                         SELECT id FROM certificate_requests
                         WHERE employee_id = @eid AND lower(status) = 'pending'
                           AND certificate_type = @type
                         LIMIT 1
                         """, conn, (NpgsqlTransaction)tx))
        {
            dup.Parameters.AddWithValue("eid", employeeId);
            dup.Parameters.AddWithValue("type", certificateType);
            var existing = await dup.ExecuteScalarAsync(ct);
            if (existing is not null and not DBNull)
                return (null, "A pending certificate request of this type already exists.");
        }

        await using var profileCmd = new NpgsqlCommand(
            """
            SELECT e.emp_code, e.full_name, e.basic_salary, e.join_date, e.job_title,
                   dg.name AS designation_name, d.name AS department_name, dv.name AS division_name
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN divisions dv ON dv.id = e.division_id
            LEFT JOIN designations dg ON dg.id = e.designation_id
            WHERE e.id = @id AND e.in_hr_ops = TRUE
            """, conn, (NpgsqlTransaction)tx);
        profileCmd.Parameters.AddWithValue("id", employeeId);
        var profile = await ReadOneAsync(profileCmd, ct);
        if (profile is null)
            return (null, "Employee not found.");

        var designation = Convert.ToString(DictGet(profile, "designationName", "designation_name", "jobTitle", "job_title")) ?? "Employee";

        await using var insert = new NpgsqlCommand(
            """
            INSERT INTO certificate_requests (
              employee_id, certificate_type, purpose, bank_name, travel_destination, status,
              emp_code, full_name, designation, department, division, basic_salary, join_date
            )
            VALUES (
              @eid, @type, @purpose, @bank, @travel, 'pending',
              @code, @name, @desig, @dept, @div, @salary, @join::date
            )
            RETURNING *
            """, conn, (NpgsqlTransaction)tx);
        insert.Parameters.AddWithValue("eid", employeeId);
        insert.Parameters.AddWithValue("type", certificateType);
        insert.Parameters.AddWithValue("purpose", (object?)purpose?.Trim() ?? DBNull.Value);
        insert.Parameters.AddWithValue("bank", (object?)bankName?.Trim() ?? DBNull.Value);
        insert.Parameters.AddWithValue("travel", (object?)travelDestination?.Trim() ?? DBNull.Value);
        insert.Parameters.AddWithValue("code", DictGet(profile, "empCode", "emp_code") ?? DBNull.Value);
        insert.Parameters.AddWithValue("name", DictGet(profile, "fullName", "full_name") ?? DBNull.Value);
        insert.Parameters.AddWithValue("desig", designation);
        insert.Parameters.AddWithValue("dept", DictGet(profile, "departmentName", "department_name") ?? DBNull.Value);
        insert.Parameters.AddWithValue("div", DictGet(profile, "divisionName", "division_name") ?? DBNull.Value);
        insert.Parameters.AddWithValue("salary", DictGet(profile, "basicSalary", "basic_salary") ?? DBNull.Value);
        insert.Parameters.AddWithValue("join", DictGet(profile, "joinDate", "join_date") ?? DBNull.Value);
        var row = (await ReadOneAsync(insert, ct))!;

        var typeLabel = CertificateGeneratorService.TypeLabel(certificateType);
        await InsertNotificationAsync(conn, (NpgsqlTransaction)tx, employeeId,
            "certificate", "Certificate request submitted",
            $"Your {typeLabel} request is pending HR review.", null, ct);

        await tx.CommitAsync(ct);
        await _email.SendCertificateRequestedAsync(employeeId, certificateType, ct);
        return (row, null);
    }

    public async Task<Dictionary<string, object?>?> UpdateCertificateStatusAsync(
        int id, string status, string? hrNote, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        await using var cmd = new NpgsqlCommand(
            """
            UPDATE certificate_requests
            SET status = @status,
                hr_note = COALESCE(@note, hr_note),
                updated_at = NOW()
            WHERE id = @id AND status = 'pending'
            RETURNING *
            """, conn, (NpgsqlTransaction)tx);
        cmd.Parameters.AddWithValue("status", status);
        cmd.Parameters.AddWithValue("note", (object?)hrNote?.Trim() ?? DBNull.Value);
        cmd.Parameters.AddWithValue("id", id);
        var row = await ReadOneAsync(cmd, ct);
        if (row is null)
        {
            await tx.RollbackAsync(ct);
            return null;
        }

        var employeeId = Convert.ToInt32(DictGet(row, "employeeId", "employee_id")!);
        var certType = Convert.ToString(DictGet(row, "certificateType", "certificate_type")) ?? "certificate";
        var typeLabel = CertificateGeneratorService.TypeLabel(certType);

        if (string.Equals(status, "approved", StringComparison.OrdinalIgnoreCase))
        {
            await InsertNotificationAsync(conn, (NpgsqlTransaction)tx, employeeId,
                "certificate", "Certificate approved",
                $"Your {typeLabel} request was approved by HR.", null, ct);
        }
        else if (string.Equals(status, "rejected", StringComparison.OrdinalIgnoreCase))
        {
            var msg = string.IsNullOrWhiteSpace(hrNote)
                ? $"Your {typeLabel} request was rejected by HR."
                : $"Your {typeLabel} request was rejected: {hrNote.Trim()}";
            await InsertNotificationAsync(conn, (NpgsqlTransaction)tx, employeeId,
                "certificate", "Certificate rejected", msg, null, ct);
        }

        await tx.CommitAsync(ct);
        return row;
    }

    public async Task<Dictionary<string, object?>?> IssueCertificateAsync(
        int id, string contentRootPath, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        await using var fetch = new NpgsqlCommand(
            "SELECT * FROM certificate_requests WHERE id = @id", conn, (NpgsqlTransaction)tx);
        fetch.Parameters.AddWithValue("id", id);
        var row = await ReadOneAsync(fetch, ct);
        if (row is null)
        {
            await tx.RollbackAsync(ct);
            return null;
        }

        var status = Convert.ToString(DictGet(row, "status")) ?? "";
        if (status is not ("pending" or "approved"))
        {
            await tx.RollbackAsync(ct);
            return null;
        }

        var certType = Convert.ToString(DictGet(row, "certificateType", "certificate_type")) ?? "salary";
        var joinRaw = DictGet(row, "joinDate", "join_date");
        var joinText = joinRaw?.ToString()?.Length >= 10 ? joinRaw.ToString()![..10] : joinRaw?.ToString();
        decimal? salary = null;
        var salRaw = DictGet(row, "basicSalary", "basic_salary");
        if (salRaw is not null and not DBNull && decimal.TryParse(salRaw.ToString(), out var sal))
            salary = sal;

        var html = CertificateGeneratorService.BuildHtml(
            certType,
            Convert.ToString(DictGet(row, "fullName", "full_name")) ?? "Employee",
            Convert.ToString(DictGet(row, "empCode", "emp_code")),
            Convert.ToString(DictGet(row, "designation")),
            Convert.ToString(DictGet(row, "department")),
            Convert.ToString(DictGet(row, "division")),
            salary,
            joinText,
            Convert.ToString(DictGet(row, "purpose")),
            Convert.ToString(DictGet(row, "bankName", "bank_name")),
            Convert.ToString(DictGet(row, "travelDestination", "travel_destination")),
            DateTime.UtcNow);

        var fileRef = await CertificateGeneratorService.SaveHtmlAsync(contentRootPath, id, html, ct);

        await using var update = new NpgsqlCommand(
            """
            UPDATE certificate_requests
            SET status = 'issued', file_ref = @file, issued_at = NOW(), updated_at = NOW()
            WHERE id = @id
            RETURNING *
            """, conn, (NpgsqlTransaction)tx);
        update.Parameters.AddWithValue("file", fileRef);
        update.Parameters.AddWithValue("id", id);
        var issued = await ReadOneAsync(update, ct);

        var employeeId = Convert.ToInt32(DictGet(row, "employeeId", "employee_id")!);
        var typeLabel = CertificateGeneratorService.TypeLabel(certType);
        await InsertNotificationAsync(conn, (NpgsqlTransaction)tx, employeeId,
            "certificate", "Certificate ready",
            $"Your {typeLabel} has been issued — open Certificates in the app or download from HR.", null, ct);

        await tx.CommitAsync(ct);
        await _email.SendCertificateIssuedAsync(employeeId, certType, ct);
        return issued;
    }

    private async Task<NpgsqlConnection> OpenAsync(CancellationToken ct)
    {
        var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        return conn;
    }

    private async Task<List<Dictionary<string, object?>>> QueryConnAsync(
        string sql, CancellationToken ct, params (string Name, object Value)[] parameters)
    {
        await using var conn = await OpenAsync(ct);
        return await QueryAsync(conn, sql, ct, parameters);
    }

    private static async Task<List<Dictionary<string, object?>>> QueryAsync(
        NpgsqlConnection conn, string sql, CancellationToken ct, params (string Name, object Value)[] parameters)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var (name, value) in parameters)
        {
            cmd.Parameters.AddWithValue(name, value);
        }

        return await ReadAllAsync(cmd, ct);
    }

    private static async Task<int> ScalarIntAsync(
        NpgsqlConnection conn, string sql, CancellationToken ct, params (string Name, object Value)[] parameters)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var (name, value) in parameters)
        {
            cmd.Parameters.AddWithValue(name, value);
        }

        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result);
    }

    private static async Task<string?> ScalarStringTxAsync(
        NpgsqlConnection conn, NpgsqlTransaction tx, string sql, CancellationToken ct,
        params (string Name, object Value)[] parameters)
    {
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        foreach (var (name, value) in parameters)
        {
            cmd.Parameters.AddWithValue(name, value);
        }

        var result = await cmd.ExecuteScalarAsync(ct);
        return result?.ToString();
    }

    private static async Task<int> ScalarIntTxAsync(
        NpgsqlConnection conn, NpgsqlTransaction tx, string sql, CancellationToken ct,
        params (string Name, object Value)[] parameters)
    {
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        foreach (var (name, value) in parameters)
        {
            cmd.Parameters.AddWithValue(name, value);
        }

        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result);
    }

    private static async Task<int> ScalarIntTxAsync(
        NpgsqlConnection conn, NpgsqlTransaction tx, string sql, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result);
    }

    private static async Task<Dictionary<string, object?>?> ReadOneAsync(NpgsqlCommand cmd, CancellationToken ct)
    {
        var rows = await ReadAllAsync(cmd, ct);
        return rows.FirstOrDefault();
    }

    private static async Task<List<Dictionary<string, object?>>> ReadAllAsync(NpgsqlCommand cmd, CancellationToken ct)
    {
        var list = new List<Dictionary<string, object?>>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            list.Add(MapRow(reader));
        }

        return list;
    }

    private static Dictionary<string, object?> MapRow(DbDataReader reader)
    {
        var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < reader.FieldCount; i++)
        {
            var name = reader.GetName(i);
            if (reader.IsDBNull(i))
            {
                row[ToCamel(name)] = null;
                continue;
            }

            var value = reader.GetValue(i);
            row[ToCamel(name)] = value switch
            {
                DateTime dt => dt.ToString("yyyy-MM-ddTHH:mm:ss"),
                DateOnly d => d.ToString("yyyy-MM-dd"),
                TimeOnly t => t.ToString("HH:mm:ss"),
                TimeSpan ts => ts.ToString(@"hh\:mm\:ss"),
                decimal dec => dec,
                JsonDocument doc => JsonSerializer.Deserialize<object>(doc.RootElement.GetRawText()),
                _ => value
            };
        }

        return row;
    }

    private static string ToCamel(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;
        if (!name.Contains('_'))
        {
            return char.ToLowerInvariant(name[0]) + name[1..];
        }

        var parts = name.Split('_', StringSplitOptions.RemoveEmptyEntries);
        return parts[0].ToLowerInvariant()
               + string.Concat(parts.Skip(1).Select(p => char.ToUpperInvariant(p[0]) + p[1..].ToLowerInvariant()));
    }

    private static string BuildFullName(string fallbackFullName, Dictionary<string, object?>? masterData)
    {
        var fromMaster = ComposeNameFromMaster(masterData);
        if (!string.IsNullOrWhiteSpace(fromMaster)) return fromMaster.Trim();
        return fallbackFullName.Trim();
    }

    private static string ComposeNameFromRequest(string? first, string? middle, string? last)
    {
        var parts = new[] { first, middle, last }
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Select(p => p!.Trim());
        return string.Join(' ', parts);
    }

    private static string ComposeNameFromMaster(Dictionary<string, object?>? masterData)
    {
        if (masterData is null) return string.Empty;
        string? Get(string key) =>
            masterData.TryGetValue(key, out var val) && val is not null ? val.ToString() : null;
        return ComposeNameFromRequest(Get("firstName"), Get("middleName"), Get("lastName"));
    }

    private static string SerializeMasterData(Dictionary<string, object?>? masterData)
    {
        if (masterData is null || masterData.Count == 0) return "{}";
        return JsonSerializer.Serialize(masterData);
    }
}
