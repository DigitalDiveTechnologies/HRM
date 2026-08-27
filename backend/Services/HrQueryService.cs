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
            WHERE e.in_hr_ops = TRUE AND e.status != 'exited'
            """;
        if (onlyEmployeeId.HasValue) sql += " AND e.id = @eid";
        sql += """
             GROUP BY e.id, e.full_name, e.emp_code, ent.leave_type, ent.entitlement_days
             ORDER BY e.emp_code, ent.leave_type
            """;

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
                    "UPDATE exit_cases SET status = 'in_progress' WHERE id = @ref AND status = 'open'",
                    conn, (NpgsqlTransaction)tx);
                exit.Parameters.AddWithValue("ref", referenceId);
                await exit.ExecuteNonQueryAsync(ct);
            }
        }

        await tx.CommitAsync(ct);
        return item;
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

        // EOSB estimate (simple: 21 days basic / year of service)
        string? eosbNote = settlementNotes;
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
                var eosb = Math.Round((basic / 30m) * 21m * (decimal)years, 2);
                var auto = $"EOSB estimate: {eosb:0.##} ({years:0.0} yrs × 21 days/yr of basic).";
                eosbNote = string.IsNullOrWhiteSpace(settlementNotes) ? auto : $"{settlementNotes.Trim()} | {auto}";
            }
        }

        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO exit_cases (employee_id, exit_type, reason, notice_date, last_working_date, settlement_notes, status)
            VALUES (@eid, @etype, @reason, @notice::date, @lwd::date, @notes, 'open')
            RETURNING *
            """, conn, (NpgsqlTransaction)tx);
        cmd.Parameters.AddWithValue("eid", employeeId);
        cmd.Parameters.AddWithValue("etype", string.IsNullOrWhiteSpace(exitType) ? "resignation" : exitType);
        cmd.Parameters.AddWithValue("reason", (object?)reason ?? DBNull.Value);
        cmd.Parameters.AddWithValue("notice", (object?)noticeDate ?? DBNull.Value);
        cmd.Parameters.AddWithValue("lwd", (object?)lastWorkingDate ?? DBNull.Value);
        cmd.Parameters.AddWithValue("notes", (object?)eosbNote ?? DBNull.Value);
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
