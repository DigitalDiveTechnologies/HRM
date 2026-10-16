using System.Data.Common;
using DigitalDive.Hr.Api.Data;
using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Announcements")]
[Route("api/announcements")]
[Authorize]
public sealed class AnnouncementsController : ControllerBase
{
    private readonly Db _db;
    private readonly RbacService _rbac;
    private readonly ILogger<AnnouncementsController> _logger;

    public AnnouncementsController(
        Db db,
        RbacService rbac,
        ILogger<AnnouncementsController> logger)
    {
        _db = db;
        _rbac = rbac;
        _logger = logger;
    }

    private async Task<bool> IsAdminOrPermAsync(CancellationToken ct, params string[] codes)
    {
        var role = CurrentUser.Role(User);
        if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase))
            return true;

        var perms = await _rbac.GetPermissionCodesForRoleAsync(role, ct);
        return codes.Any(code =>
            perms.Any(p => string.Equals(p, code, StringComparison.OrdinalIgnoreCase)));
    }

    private async Task<(int? EmployeeId, int? DivisionId, int? DepartmentId)> ResolveEmployeeContextAsync(
        NpgsqlConnection conn, CancellationToken ct)
    {
        var empId = CurrentUser.EmployeeId(User);
        var email = CurrentUser.Email(User);

        if (empId is > 0)
        {
            await using var cmd = new NpgsqlCommand(
                "SELECT id, division_id, department_id FROM employees WHERE id = @id", conn);
            cmd.Parameters.AddWithValue("id", empId.Value);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                return (
                    reader.GetInt32(0),
                    reader.IsDBNull(1) ? null : reader.GetInt32(1),
                    reader.IsDBNull(2) ? null : reader.GetInt32(2)
                );
            }
        }

        if (!string.IsNullOrWhiteSpace(email))
        {
            await using var cmd = new NpgsqlCommand(
                "SELECT id, division_id, department_id FROM employees WHERE LOWER(TRIM(email)) = LOWER(TRIM(@email)) LIMIT 1", conn);
            cmd.Parameters.AddWithValue("email", email.Trim());
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                return (
                    reader.GetInt32(0),
                    reader.IsDBNull(1) ? null : reader.GetInt32(1),
                    reader.IsDBNull(2) ? null : reader.GetInt32(2)
                );
            }
        }

        return (null, null, null);
    }

    /// <summary>
    /// GET /api/announcements
    /// Returns announcements targeted to the user's scope with read receipt acknowledgement status.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool all = false, CancellationToken ct = default)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        var (empId, divId, deptId) = await ResolveEmployeeContextAsync(conn, ct);
        var role = CurrentUser.Role(User).ToLowerInvariant();
        var isAdmin = string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase)
                      || string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase);

        string sql;
        NpgsqlCommand cmd;

        if (isAdmin && all)
        {
            // Admin requesting full unfiltered list
            sql = """
                SELECT 
                    ca.id,
                    ca.title,
                    ca.body_html,
                    ca.category,
                    ca.priority,
                    ca.audience_type,
                    ca.division_id,
                    ca.department_id,
                    div.name AS division_name,
                    dept.name AS department_name,
                    ca.requires_ack,
                    ca.is_pinned,
                    ca.author_email,
                    ca.published_at,
                    ca.expires_at,
                    ca.created_at,
                    ca.updated_at,
                    (SELECT COUNT(*)::int FROM announcement_acks ack WHERE ack.announcement_id = ca.id) AS ack_count,
                    (CASE WHEN my_ack.id IS NOT NULL THEN TRUE ELSE FALSE END) AS has_acknowledged,
                    my_ack.acknowledged_at
                FROM company_announcements ca
                LEFT JOIN divisions div ON div.id = ca.division_id
                LEFT JOIN departments dept ON dept.id = ca.department_id
                LEFT JOIN announcement_acks my_ack ON my_ack.announcement_id = ca.id AND my_ack.employee_id = @empId
                ORDER BY ca.is_pinned DESC, ca.published_at DESC
                """;
            cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("empId", (object?)empId ?? DBNull.Value);
        }
        else if (isAdmin)
        {
            // Admin active notices
            sql = """
                SELECT 
                    ca.id,
                    ca.title,
                    ca.body_html,
                    ca.category,
                    ca.priority,
                    ca.audience_type,
                    ca.division_id,
                    ca.department_id,
                    div.name AS division_name,
                    dept.name AS department_name,
                    ca.requires_ack,
                    ca.is_pinned,
                    ca.author_email,
                    ca.published_at,
                    ca.expires_at,
                    ca.created_at,
                    ca.updated_at,
                    (SELECT COUNT(*)::int FROM announcement_acks ack WHERE ack.announcement_id = ca.id) AS ack_count,
                    (CASE WHEN my_ack.id IS NOT NULL THEN TRUE ELSE FALSE END) AS has_acknowledged,
                    my_ack.acknowledged_at
                FROM company_announcements ca
                LEFT JOIN divisions div ON div.id = ca.division_id
                LEFT JOIN departments dept ON dept.id = ca.department_id
                LEFT JOIN announcement_acks my_ack ON my_ack.announcement_id = ca.id AND my_ack.employee_id = @empId
                WHERE (ca.expires_at IS NULL OR ca.expires_at > NOW())
                ORDER BY ca.is_pinned DESC, ca.published_at DESC
                """;
            cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("empId", (object?)empId ?? DBNull.Value);
        }
        else
        {
            // Employee scoped filter
            sql = """
                SELECT 
                    ca.id,
                    ca.title,
                    ca.body_html,
                    ca.category,
                    ca.priority,
                    ca.audience_type,
                    ca.division_id,
                    ca.department_id,
                    div.name AS division_name,
                    dept.name AS department_name,
                    ca.requires_ack,
                    ca.is_pinned,
                    ca.author_email,
                    ca.published_at,
                    ca.expires_at,
                    ca.created_at,
                    ca.updated_at,
                    (SELECT COUNT(*)::int FROM announcement_acks ack WHERE ack.announcement_id = ca.id) AS ack_count,
                    (CASE WHEN my_ack.id IS NOT NULL THEN TRUE ELSE FALSE END) AS has_acknowledged,
                    my_ack.acknowledged_at
                FROM company_announcements ca
                LEFT JOIN divisions div ON div.id = ca.division_id
                LEFT JOIN departments dept ON dept.id = ca.department_id
                LEFT JOIN announcement_acks my_ack ON my_ack.announcement_id = ca.id AND my_ack.employee_id = @empId
                WHERE (
                    ca.audience_type = 'all'
                    OR (ca.audience_type = 'division' AND ca.division_id = @divId)
                    OR (ca.audience_type = 'department' AND ca.department_id = @deptId)
                )
                AND (ca.expires_at IS NULL OR ca.expires_at > NOW())
                ORDER BY ca.is_pinned DESC, ca.published_at DESC
                """;
            cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("empId", (object?)empId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("divId", (object?)divId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("deptId", (object?)deptId ?? DBNull.Value);
        }

        await using (cmd)
        {
            var list = new List<Dictionary<string, object?>>();
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                list.Add(MapRow(reader));
            }
            return Ok(list);
        }
    }

    /// <summary>
    /// POST /api/announcements
    /// Create a persistent company announcement (Admin role required).
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAnnouncementDto body, CancellationToken ct)
    {
        if (!await IsAdminOrPermAsync(ct, "dashboard.view", "employees.list"))
            return Forbid();

        if (string.IsNullOrWhiteSpace(body.Title))
            return BadRequest(new { error = "Announcement title is required." });

        var bodyHtml = !string.IsNullOrWhiteSpace(body.BodyHtml)
            ? body.BodyHtml.Trim()
            : (!string.IsNullOrWhiteSpace(body.Content) ? body.Content.Trim() : (body.Desc ?? ""));

        var category = string.IsNullOrWhiteSpace(body.Category) ? "General" : body.Category.Trim();
        var priority = string.IsNullOrWhiteSpace(body.Priority) ? "normal" : body.Priority.Trim().ToLowerInvariant();
        var audienceType = string.IsNullOrWhiteSpace(body.AudienceType) ? "all" : body.AudienceType.Trim().ToLowerInvariant();
        var authorEmail = CurrentUser.Email(User) ?? "admin@digitaldive.demo";

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        const string sql = """
            INSERT INTO company_announcements (
                title, body_html, category, priority, audience_type,
                division_id, department_id, requires_ack, is_pinned,
                author_email, published_at, expires_at, created_at, updated_at
            )
            VALUES (
                @title, @bodyHtml, @category, @priority, @audienceType,
                @divisionId, @departmentId, @requiresAck, @isPinned,
                @authorEmail, NOW(), @expiresAt, NOW(), NOW()
            )
            RETURNING id, title, body_html, category, priority, audience_type,
                      division_id, department_id, requires_ack, is_pinned,
                      author_email, published_at, expires_at, created_at, updated_at;
            """;

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("title", body.Title.Trim());
        cmd.Parameters.AddWithValue("bodyHtml", bodyHtml);
        cmd.Parameters.AddWithValue("category", category);
        cmd.Parameters.AddWithValue("priority", priority);
        cmd.Parameters.AddWithValue("audienceType", audienceType);
        cmd.Parameters.AddWithValue("divisionId", (object?)body.DivisionId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("departmentId", (object?)body.DepartmentId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("requiresAck", body.RequiresAck ?? false);
        cmd.Parameters.AddWithValue("isPinned", body.IsPinned ?? false);
        cmd.Parameters.AddWithValue("authorEmail", authorEmail);
        cmd.Parameters.AddWithValue("expiresAt", (object?)body.ExpiresAt ?? DBNull.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct))
        {
            var row = MapRow(reader);
            row["ackCount"] = 0;
            row["hasAcknowledged"] = false;
            return Ok(row);
        }

        return BadRequest(new { error = "Failed to create announcement." });
    }

    /// <summary>
    /// PUT /api/announcements/{id}
    /// Update existing announcement (Admin role required).
    /// </summary>
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateAnnouncementDto body, CancellationToken ct)
    {
        if (!await IsAdminOrPermAsync(ct, "dashboard.view", "employees.list"))
            return Forbid();

        if (string.IsNullOrWhiteSpace(body.Title))
            return BadRequest(new { error = "Announcement title is required." });

        var bodyHtml = !string.IsNullOrWhiteSpace(body.BodyHtml)
            ? body.BodyHtml.Trim()
            : (!string.IsNullOrWhiteSpace(body.Content) ? body.Content.Trim() : (body.Desc ?? ""));

        var category = string.IsNullOrWhiteSpace(body.Category) ? "General" : body.Category.Trim();
        var priority = string.IsNullOrWhiteSpace(body.Priority) ? "normal" : body.Priority.Trim().ToLowerInvariant();
        var audienceType = string.IsNullOrWhiteSpace(body.AudienceType) ? "all" : body.AudienceType.Trim().ToLowerInvariant();

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        const string sql = """
            UPDATE company_announcements
            SET title = @title,
                body_html = @bodyHtml,
                category = @category,
                priority = @priority,
                audience_type = @audienceType,
                division_id = @divisionId,
                department_id = @departmentId,
                requires_ack = @requiresAck,
                is_pinned = @isPinned,
                expires_at = @expiresAt,
                updated_at = NOW()
            WHERE id = @id
            RETURNING id, title, body_html, category, priority, audience_type,
                      division_id, department_id, requires_ack, is_pinned,
                      author_email, published_at, expires_at, created_at, updated_at;
            """;

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("title", body.Title.Trim());
        cmd.Parameters.AddWithValue("bodyHtml", bodyHtml);
        cmd.Parameters.AddWithValue("category", category);
        cmd.Parameters.AddWithValue("priority", priority);
        cmd.Parameters.AddWithValue("audienceType", audienceType);
        cmd.Parameters.AddWithValue("divisionId", (object?)body.DivisionId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("departmentId", (object?)body.DepartmentId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("requiresAck", body.RequiresAck ?? false);
        cmd.Parameters.AddWithValue("isPinned", body.IsPinned ?? false);
        cmd.Parameters.AddWithValue("expiresAt", (object?)body.ExpiresAt ?? DBNull.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct))
        {
            var row = MapRow(reader);
            return Ok(row);
        }

        return NotFound(new { error = $"Announcement #{id} not found." });
    }

    /// <summary>
    /// DELETE /api/announcements/{id}
    /// Delete announcement (Admin role required).
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!await IsAdminOrPermAsync(ct, "dashboard.view", "employees.list"))
            return Forbid();

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        await using var cmd = new NpgsqlCommand("DELETE FROM company_announcements WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", id);
        var rows = await cmd.ExecuteNonQueryAsync(ct);
        if (rows == 0) return NotFound(new { error = $"Announcement #{id} not found." });

        return Ok(new { ok = true, message = $"Announcement #{id} deleted." });
    }

    /// <summary>
    /// POST /api/announcements/{id}/acknowledge
    /// Records compliance read receipt for the current signed-in employee.
    /// </summary>
    [HttpPost("{id:int}/acknowledge")]
    public async Task<IActionResult> Acknowledge(int id, CancellationToken ct)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        var (empId, _, _) = await ResolveEmployeeContextAsync(conn, ct);
        if (empId is null or <= 0)
        {
            return BadRequest(new { error = "Unable to determine employee identity for acknowledgement." });
        }

        // Verify announcement exists
        await using (var checkCmd = new NpgsqlCommand("SELECT id FROM company_announcements WHERE id = @id", conn))
        {
            checkCmd.Parameters.AddWithValue("id", id);
            var exists = await checkCmd.ExecuteScalarAsync(ct);
            if (exists is null or DBNull)
            {
                return NotFound(new { error = $"Announcement #{id} not found." });
            }
        }

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        const string sql = """
            INSERT INTO announcement_acks (announcement_id, employee_id, acknowledged_at, ip_address)
            VALUES (@annId, @empId, NOW(), @ip)
            ON CONFLICT (announcement_id, employee_id)
            DO UPDATE SET acknowledged_at = NOW(), ip_address = EXCLUDED.ip_address
            RETURNING acknowledged_at;
            """;

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("annId", id);
        cmd.Parameters.AddWithValue("empId", empId.Value);
        cmd.Parameters.AddWithValue("ip", ip);

        var ackAt = await cmd.ExecuteScalarAsync(ct);

        return Ok(new
        {
            ok = true,
            announcementId = id,
            employeeId = empId.Value,
            acknowledgedAt = ackAt is DateTime dt ? dt.ToString("yyyy-MM-ddTHH:mm:ss") : DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss"),
            message = "Announcement successfully acknowledged."
        });
    }

    /// <summary>
    /// GET /api/announcements/{id}/compliance
    /// Returns read metrics, eligible employee headcount, read receipts, and pending receipts (Admin role required).
    /// </summary>
    [HttpGet("{id:int}/compliance")]
    public async Task<IActionResult> Compliance(int id, CancellationToken ct)
    {
        if (!await IsAdminOrPermAsync(ct, "dashboard.view", "compliance.view", "reports.view"))
            return Forbid();

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        Dictionary<string, object?>? announcement = null;
        await using (var annCmd = new NpgsqlCommand(
            """
            SELECT ca.*, div.name AS division_name, dept.name AS department_name
            FROM company_announcements ca
            LEFT JOIN divisions div ON div.id = ca.division_id
            LEFT JOIN departments dept ON dept.id = ca.department_id
            WHERE ca.id = @id
            """, conn))
        {
            annCmd.Parameters.AddWithValue("id", id);
            await using var reader = await annCmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                announcement = MapRow(reader);
            }
        }

        if (announcement is null)
            return NotFound(new { error = $"Announcement #{id} not found." });

        var audienceType = Convert.ToString(announcement["audienceType"])?.ToLowerInvariant() ?? "all";
        var divId = announcement["divisionId"] is int d ? d : (int?)null;
        var deptId = announcement["departmentId"] is int dp ? dp : (int?)null;

        // Total eligible employees query
        string eligibleSql = audienceType switch
        {
            "division" => "SELECT COUNT(*)::int FROM employees WHERE in_hr_ops = TRUE AND status = 'active' AND division_id = @divId",
            "department" => "SELECT COUNT(*)::int FROM employees WHERE in_hr_ops = TRUE AND status = 'active' AND department_id = @deptId",
            _ => "SELECT COUNT(*)::int FROM employees WHERE in_hr_ops = TRUE AND status = 'active'"
        };

        int totalEligible;
        await using (var elCmd = new NpgsqlCommand(eligibleSql, conn))
        {
            if (divId.HasValue) elCmd.Parameters.AddWithValue("divId", divId.Value);
            if (deptId.HasValue) elCmd.Parameters.AddWithValue("deptId", deptId.Value);
            var o = await elCmd.ExecuteScalarAsync(ct);
            totalEligible = o is null or DBNull ? 0 : Convert.ToInt32(o);
        }

        // Acknowledged employees query
        var acknowledgements = new List<Dictionary<string, object?>>();
        const string acksSql = """
            SELECT 
                ack.employee_id,
                e.full_name,
                e.emp_code,
                d.name AS department_name,
                ack.acknowledged_at,
                ack.ip_address
            FROM announcement_acks ack
            JOIN employees e ON e.id = ack.employee_id
            LEFT JOIN departments d ON d.id = e.department_id
            WHERE ack.announcement_id = @annId
            ORDER BY ack.acknowledged_at DESC;
            """;

        await using (var ackCmd = new NpgsqlCommand(acksSql, conn))
        {
            ackCmd.Parameters.AddWithValue("annId", id);
            await using var reader = await ackCmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                acknowledgements.Add(MapRow(reader));
            }
        }

        // Pending employees query
        string pendingSql = audienceType switch
        {
            "division" => """
                SELECT e.id AS employee_id, e.full_name, e.emp_code, d.name AS department_name
                FROM employees e
                LEFT JOIN departments d ON d.id = e.department_id
                WHERE e.in_hr_ops = TRUE AND e.status = 'active' AND e.division_id = @divId
                  AND e.id NOT IN (SELECT employee_id FROM announcement_acks WHERE announcement_id = @annId)
                ORDER BY e.full_name ASC;
                """,
            "department" => """
                SELECT e.id AS employee_id, e.full_name, e.emp_code, d.name AS department_name
                FROM employees e
                LEFT JOIN departments d ON d.id = e.department_id
                WHERE e.in_hr_ops = TRUE AND e.status = 'active' AND e.department_id = @deptId
                  AND e.id NOT IN (SELECT employee_id FROM announcement_acks WHERE announcement_id = @annId)
                ORDER BY e.full_name ASC;
                """,
            _ => """
                SELECT e.id AS employee_id, e.full_name, e.emp_code, d.name AS department_name
                FROM employees e
                LEFT JOIN departments d ON d.id = e.department_id
                WHERE e.in_hr_ops = TRUE AND e.status = 'active'
                  AND e.id NOT IN (SELECT employee_id FROM announcement_acks WHERE announcement_id = @annId)
                ORDER BY e.full_name ASC;
                """
        };

        var pendingList = new List<Dictionary<string, object?>>();
        await using (var pendCmd = new NpgsqlCommand(pendingSql, conn))
        {
            pendCmd.Parameters.AddWithValue("annId", id);
            if (divId.HasValue) pendCmd.Parameters.AddWithValue("divId", divId.Value);
            if (deptId.HasValue) pendCmd.Parameters.AddWithValue("deptId", deptId.Value);
            await using var reader = await pendCmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                pendingList.Add(MapRow(reader));
            }
        }

        var totalAcknowledged = acknowledgements.Count;
        var complianceRate = totalEligible > 0
            ? Math.Round((double)totalAcknowledged / totalEligible * 100.0, 1)
            : (totalAcknowledged > 0 ? 100.0 : 0.0);

        return Ok(new
        {
            announcement,
            totalEligible,
            totalAcknowledged,
            pendingCount = pendingList.Count,
            complianceRate,
            acknowledgements,
            pendingAcknowledgements = pendingList
        });
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
                DateTimeOffset dto => dto.ToString("yyyy-MM-ddTHH:mm:sszzz"),
                DateOnly d => d.ToString("yyyy-MM-dd"),
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

public sealed record CreateAnnouncementDto(
    string Title,
    string? BodyHtml,
    string? Content,
    string? Desc,
    string? Category,
    string? Priority,
    string? AudienceType,
    int? DivisionId,
    int? DepartmentId,
    bool? RequiresAck,
    bool? IsPinned,
    DateTime? ExpiresAt);
