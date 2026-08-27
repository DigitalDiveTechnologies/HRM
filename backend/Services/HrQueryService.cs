using System.Data;
using System.Data.Common;
using DigitalDive.Hr.Api.Data;
using DigitalDive.Hr.Api.Helpers;
using Npgsql;

namespace DigitalDive.Hr.Api.Services;

public sealed class HrQueryService
{
    private readonly Db _db;

    public HrQueryService(Db db) => _db = db;

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
            SELECT e.*, d.name AS department_name, m.full_name AS manager_name
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN employees m ON m.id = e.manager_id
            WHERE e.in_hr_ops = TRUE
            ORDER BY e.emp_code
            """, ct);

    public async Task<Dictionary<string, object?>?> EmployeeByIdAsync(int id, CancellationToken ct)
    {
        var rows = await QueryConnAsync(
            """
            SELECT e.*, d.name AS department_name
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            WHERE e.id = @id
            """, ct, ("id", id));
        return rows.FirstOrDefault();
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
        int employeeId, string workDate, string? checkIn, string? checkOut, string? status, decimal overtime, CancellationToken ct)
    {
        var resolved = AttendanceLate.Resolve(checkIn, status);
        await using var conn = await OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO attendance (employee_id, work_date, check_in, check_out, status, late_minutes, overtime_hours)
            VALUES (@eid, @wd::date, @cin::time, @cout::time, @status, @late, @ot)
            RETURNING *
            """, conn);
        cmd.Parameters.AddWithValue("eid", employeeId);
        cmd.Parameters.AddWithValue("wd", workDate);
        cmd.Parameters.AddWithValue("cin", (object?)checkIn ?? DBNull.Value);
        cmd.Parameters.AddWithValue("cout", (object?)checkOut ?? DBNull.Value);
        cmd.Parameters.AddWithValue("status", resolved.Status);
        cmd.Parameters.AddWithValue("late", resolved.LateMinutes);
        cmd.Parameters.AddWithValue("ot", overtime);
        return (await ReadOneAsync(cmd, ct))!;
    }

    public async Task<List<Dictionary<string, object?>>> LeaveAsync(int? onlyEmployeeId, CancellationToken ct)
    {
        var sql =
            """
            SELECT l.*, e.full_name, e.emp_code
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

    public async Task<Dictionary<string, object?>> CreateLeaveAsync(
        int employeeId, string leaveType, string startDate, string endDate, decimal days, string? reason, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

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

        await tx.CommitAsync(ct);
        return leave;
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
            SELECT p.*, e.full_name, e.emp_code, e.basic_salary AS current_basic
            FROM payslips p
            JOIN employees e ON e.id = p.employee_id
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

        if (string.Equals(Convert.ToString(item["request_type"]), "leave", StringComparison.OrdinalIgnoreCase)
            && item["reference_id"] is not null and not DBNull)
        {
            await using var leave = new NpgsqlCommand(
                "UPDATE leave_requests SET status = @status WHERE id = @ref",
                conn, (NpgsqlTransaction)tx);
            leave.Parameters.AddWithValue("status", status);
            leave.Parameters.AddWithValue("ref", Convert.ToInt32(item["reference_id"]));
            await leave.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);
        return item;
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
        sql += " ORDER BY n.is_read ASC, n.due_date NULLS LAST, n.id DESC";

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

    private static async Task<int> ScalarIntAsync(NpgsqlConnection conn, string sql, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
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
}
