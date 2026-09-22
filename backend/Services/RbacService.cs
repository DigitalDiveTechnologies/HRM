using DigitalDive.Hr.Api.Data;
using DigitalDive.Hr.Api.Models;
using Npgsql;

namespace DigitalDive.Hr.Api.Services;

public sealed class RbacService
{
    private readonly Db _db;

    public RbacService(Db db) => _db = db;

    public async Task<string?> GetPortalForRoleAsync(string roleCode, CancellationToken ct = default)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            "SELECT portal FROM roles WHERE LOWER(code) = LOWER(@code) LIMIT 1", conn);
        cmd.Parameters.AddWithValue("code", roleCode.Trim());
        var portal = await cmd.ExecuteScalarAsync(ct) as string;
        return portal;
    }

    public async Task<IReadOnlyList<RoleDto>> ListRolesAsync(CancellationToken ct = default)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            SELECT id, code, name, description, portal, is_system
            FROM roles
            ORDER BY
              CASE portal WHEN 'users' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
              name
            """,
            conn);

        var list = new List<RoleDto>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            list.Add(new RoleDto
            {
                Id = reader.GetInt32(0),
                Code = reader.GetString(1),
                Name = reader.GetString(2),
                Description = reader.IsDBNull(3) ? null : reader.GetString(3),
                Portal = reader.GetString(4),
                IsSystem = reader.GetBoolean(5),
            });
        }
        return list;
    }

    public async Task<IReadOnlyList<RbacUserDto>> ListUsersAsync(CancellationToken ct = default)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            SELECT
              u.id,
              u.email,
              COALESCE(NULLIF(u.display_name, ''), e.full_name, u.email) AS display_name,
              u.role,
              COALESCE(r.name, r2.name, u.role) AS role_name,
              COALESCE(r.portal, r2.portal, CASE
                WHEN LOWER(u.role) = 'super_admin' THEN 'users'
                WHEN LOWER(u.role) = 'employee' THEN 'employee'
                ELSE 'admin'
              END) AS portal,
              COALESCE(u.is_active, TRUE) AS is_active,
              u.employee_id
            FROM users u
            LEFT JOIN roles r ON r.id = u.role_id
            LEFT JOIN roles r2 ON LOWER(r2.code) = LOWER(u.role)
            LEFT JOIN employees e ON e.id = u.employee_id
            WHERE LOWER(u.role) <> 'employee'
              AND COALESCE(r.portal, r2.portal, CASE
                    WHEN LOWER(u.role) = 'super_admin' THEN 'users'
                    WHEN LOWER(u.role) = 'employee' THEN 'employee'
                    ELSE 'admin'
                  END) IN ('users', 'admin')
            ORDER BY
              CASE LOWER(u.role) WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
              u.id
            """,
            conn);

        var list = new List<RbacUserDto>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            list.Add(new RbacUserDto
            {
                Id = reader.GetInt32(0),
                Email = reader.GetString(1),
                DisplayName = reader.IsDBNull(2) ? null : reader.GetString(2),
                Role = reader.GetString(3),
                RoleName = reader.GetString(4),
                Portal = reader.GetString(5),
                IsActive = reader.GetBoolean(6),
                EmployeeId = reader.IsDBNull(7) ? null : reader.GetInt32(7),
            });
        }
        return list;
    }

    public async Task<(RbacUserDto? User, string? Error)> CreateUserAsync(
        CreateRbacUserRequest req, CancellationToken ct = default)
    {
        var email = (req.Email ?? string.Empty).Trim().ToLowerInvariant();
        var roleCode = (req.RoleCode ?? string.Empty).Trim().ToLowerInvariant();
        var password = (req.Password ?? string.Empty).Trim();
        var displayName = string.IsNullOrWhiteSpace(req.DisplayName) ? null : req.DisplayName.Trim();

        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            return (null, "A valid email is required.");
        if (password.Length < 6)
            return (null, "Password must be at least 6 characters.");
        if (string.IsNullOrWhiteSpace(roleCode))
            return (null, "Role is required.");
        if (roleCode is "super_admin" or "employee")
            return (null, "Users portal only assigns Admin / Manager roles for the HR portal.");

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        await using var roleCmd = new NpgsqlCommand(
            "SELECT id, name, portal FROM roles WHERE LOWER(code) = @code LIMIT 1", conn);
        roleCmd.Parameters.AddWithValue("code", roleCode);
        await using var roleReader = await roleCmd.ExecuteReaderAsync(ct);
        if (!await roleReader.ReadAsync(ct))
        {
            return (null, "Unknown role. Roles must exist in the database.");
        }
        var roleId = roleReader.GetInt32(0);
        var roleName = roleReader.GetString(1);
        var portal = roleReader.GetString(2);
        await roleReader.CloseAsync();

        if (!string.Equals(portal, "admin", StringComparison.OrdinalIgnoreCase))
            return (null, "Only HR Admin portal roles can be assigned here. Employees stay on the Employee portal.");

        await using var exists = new NpgsqlCommand(
            "SELECT 1 FROM users WHERE LOWER(email) = @email LIMIT 1", conn);
        exists.Parameters.AddWithValue("email", email);
        if (await exists.ExecuteScalarAsync(ct) is not null)
            return (null, "A user with this email already exists.");

        var hash = PasswordHasher.Hash(password);
        await using var insert = new NpgsqlCommand(
            """
            INSERT INTO users (email, password, role, employee_id, display_name, is_active, role_id)
            VALUES (@email, @hash, @role, NULL, @display, TRUE, @roleId)
            RETURNING id
            """,
            conn);
        insert.Parameters.AddWithValue("email", email);
        insert.Parameters.AddWithValue("hash", hash);
        insert.Parameters.AddWithValue("role", roleCode);
        insert.Parameters.AddWithValue("display", (object?)displayName ?? DBNull.Value);
        insert.Parameters.AddWithValue("roleId", roleId);

        var id = Convert.ToInt32(await insert.ExecuteScalarAsync(ct));
        return (new RbacUserDto
        {
            Id = id,
            Email = email,
            DisplayName = displayName ?? email,
            Role = roleCode,
            RoleName = roleName,
            Portal = portal,
            IsActive = true,
            EmployeeId = null,
        }, null);
    }

    public async Task<(RbacUserDto? User, string? Error)> UpdateUserAsync(
        int userId, UpdateRbacUserRequest req, CancellationToken ct = default)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        await using var cur = new NpgsqlCommand(
            "SELECT role, COALESCE(is_active, TRUE) FROM users WHERE id = @id", conn);
        cur.Parameters.AddWithValue("id", userId);
        await using var curReader = await cur.ExecuteReaderAsync(ct);
        if (!await curReader.ReadAsync(ct))
            return (null, "User not found.");
        var currentRole = curReader.GetString(0);
        await curReader.CloseAsync();

        if (string.Equals(currentRole, "employee", StringComparison.OrdinalIgnoreCase))
            return (null, "Employee accounts are managed from the HR Admin portal, not here.");

        if (string.Equals(currentRole, "super_admin", StringComparison.OrdinalIgnoreCase)
            && req.RoleCode is not null
            && !string.Equals(req.RoleCode.Trim(), "super_admin", StringComparison.OrdinalIgnoreCase))
        {
            return (null, "Cannot change the Super Admin role.");
        }

        string? roleCode = null;
        int? roleId = null;
        string? roleName = null;
        string? portal = null;

        if (!string.IsNullOrWhiteSpace(req.RoleCode))
        {
            roleCode = req.RoleCode.Trim().ToLowerInvariant();
            if (roleCode is "super_admin" or "employee")
                return (null, "Users portal only assigns Admin / Manager roles for the HR portal.");

            await using var roleCmd = new NpgsqlCommand(
                "SELECT id, name, portal FROM roles WHERE LOWER(code) = @code LIMIT 1", conn);
            roleCmd.Parameters.AddWithValue("code", roleCode);
            await using var roleReader = await roleCmd.ExecuteReaderAsync(ct);
            if (!await roleReader.ReadAsync(ct))
                return (null, "Unknown role. Roles must exist in the database.");
            roleId = roleReader.GetInt32(0);
            roleName = roleReader.GetString(1);
            portal = roleReader.GetString(2);
            await roleReader.CloseAsync();

            if (!string.Equals(portal, "admin", StringComparison.OrdinalIgnoreCase))
                return (null, "Only HR Admin portal roles can be assigned here.");
        }

        if (!string.IsNullOrWhiteSpace(req.Password))
        {
            if (req.Password.Trim().Length < 6)
                return (null, "Password must be at least 6 characters.");
            await using var pw = new NpgsqlCommand(
                "UPDATE users SET password = @hash WHERE id = @id", conn);
            pw.Parameters.AddWithValue("hash", PasswordHasher.Hash(req.Password.Trim()));
            pw.Parameters.AddWithValue("id", userId);
            await pw.ExecuteNonQueryAsync(ct);
        }

        await using var update = new NpgsqlCommand(
            """
            UPDATE users SET
              display_name = COALESCE(@display, display_name),
              role = COALESCE(@role, role),
              role_id = COALESCE(@roleId, role_id),
              is_active = COALESCE(@active, is_active)
            WHERE id = @id
            """,
            conn);
        update.Parameters.AddWithValue("id", userId);
        update.Parameters.AddWithValue("display",
            string.IsNullOrWhiteSpace(req.DisplayName) ? (object)DBNull.Value : req.DisplayName.Trim());
        update.Parameters.AddWithValue("role", (object?)roleCode ?? DBNull.Value);
        update.Parameters.AddWithValue("roleId", (object?)roleId ?? DBNull.Value);
        update.Parameters.AddWithValue("active", req.IsActive.HasValue ? req.IsActive.Value : (object)DBNull.Value);
        await update.ExecuteNonQueryAsync(ct);

        var all = await ListUsersAsync(ct);
        var user = all.FirstOrDefault(u => u.Id == userId);
        if (user is not null && roleName is not null)
        {
            user.RoleName = roleName;
            user.Portal = portal ?? user.Portal;
        }
        return (user, user is null ? "User not found after update." : null);
    }
}
