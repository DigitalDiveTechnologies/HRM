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

    public async Task<IReadOnlyList<string>> GetPermissionCodesForRoleAsync(string roleCode, CancellationToken ct = default)
    {
        var code = (roleCode ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(code)) return Array.Empty<string>();

        // Super Admin always has every catalog permission + Settings (client-side)
        if (code == "super_admin")
        {
            return await ListAllPermissionCodesAsync(ct);
        }

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        try
        {
            await using var existsCmd = new NpgsqlCommand(
                "SELECT 1 FROM roles WHERE LOWER(code) = @code LIMIT 1", conn);
            existsCmd.Parameters.AddWithValue("code", code);
            var roleExists = await existsCmd.ExecuteScalarAsync(ct) is not null;

            // Admin keeps full portal access if the admin role row was removed (Users/Roles temporarily off)
            if (!roleExists && code == "admin")
                return await ListAllPermissionCodesAsync(ct);

            await using var cmd = new NpgsqlCommand(
                """
                SELECT p.code
                FROM role_permissions rp
                JOIN roles r ON r.id = rp.role_id
                JOIN permissions p ON p.id = rp.permission_id
                WHERE LOWER(r.code) = @code
                ORDER BY p.sort_order, p.id
                """,
                conn);
            cmd.Parameters.AddWithValue("code", code);
            var list = new List<string>();
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                list.Add(reader.GetString(0));
            return list;
        }
        catch (PostgresException ex) when (ex.SqlState == "42P01")
        {
            return Array.Empty<string>();
        }
    }

    private async Task<IReadOnlyList<string>> ListAllPermissionCodesAsync(CancellationToken ct)
    {
        await using var connAll = _db.CreateConnection();
        await connAll.OpenAsync(ct);
        try
        {
            await using var all = new NpgsqlCommand(
                "SELECT code FROM permissions ORDER BY sort_order, id", connAll);
            var list = new List<string>();
            await using var reader = await all.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                list.Add(reader.GetString(0));
            return list;
        }
        catch (PostgresException ex) when (ex.SqlState == "42P01")
        {
            return Array.Empty<string>();
        }
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
              CASE LOWER(code)
                WHEN 'super_admin' THEN 0
                WHEN 'admin' THEN 1
                WHEN 'manager' THEN 2
                WHEN 'hr_officer' THEN 3
                WHEN 'finance' THEN 4
                WHEN 'viewer' THEN 5
                WHEN 'employee' THEN 6
                ELSE 9
              END,
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

    static string SlugifyRoleCode(string name)
    {
        var raw = (name ?? string.Empty).Trim().ToLowerInvariant();
        var chars = raw.Select(ch => char.IsLetterOrDigit(ch) ? ch : '_').ToArray();
        var slug = new string(chars);
        while (slug.Contains("__", StringComparison.Ordinal))
            slug = slug.Replace("__", "_", StringComparison.Ordinal);
        return slug.Trim('_');
    }

    public async Task<(RoleDto? Role, string? Error)> CreateRoleAsync(
        CreateRoleRequest req, CancellationToken ct = default)
    {
        var name = (req.Name ?? string.Empty).Trim();
        if (name.Length < 2)
            return (null, "Role name is required.");

        var code = string.IsNullOrWhiteSpace(req.Code)
            ? SlugifyRoleCode(name)
            : SlugifyRoleCode(req.Code);
        if (string.IsNullOrWhiteSpace(code))
            return (null, "Could not build a valid role code from the name.");
        if (code is "employee")
            return (null, "This role code is reserved.");

        var description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        await using var exists = new NpgsqlCommand(
            "SELECT 1 FROM roles WHERE LOWER(code) = @code LIMIT 1", conn);
        exists.Parameters.AddWithValue("code", code);
        if (await exists.ExecuteScalarAsync(ct) is not null)
            return (null, "A role with this code already exists.");

        await using var nameExists = new NpgsqlCommand(
            "SELECT 1 FROM roles WHERE LOWER(TRIM(name)) = LOWER(@name) LIMIT 1", conn);
        nameExists.Parameters.AddWithValue("name", name);
        if (await nameExists.ExecuteScalarAsync(ct) is not null)
            return (null, "A role with this name already exists. Each role name must be unique.");

        await using var insert = new NpgsqlCommand(
            """
            INSERT INTO roles (code, name, description, portal, is_system)
            VALUES (@code, @name, @description, 'admin', FALSE)
            RETURNING id, code, name, description, portal, is_system
            """,
            conn);
        insert.Parameters.AddWithValue("code", code);
        insert.Parameters.AddWithValue("name", name);
        insert.Parameters.AddWithValue("description", (object?)description ?? DBNull.Value);

        await using var reader = await insert.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
            return (null, "Could not create role.");
        return (new RoleDto
        {
            Id = reader.GetInt32(0),
            Code = reader.GetString(1),
            Name = reader.GetString(2),
            Description = reader.IsDBNull(3) ? null : reader.GetString(3),
            Portal = reader.GetString(4),
            IsSystem = reader.GetBoolean(5),
        }, null);
    }

    public async Task<(bool Ok, string? Error)> DeleteRoleAsync(int roleId, CancellationToken ct = default)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        await using var cur = new NpgsqlCommand(
            "SELECT code, is_system FROM roles WHERE id = @id", conn);
        cur.Parameters.AddWithValue("id", roleId);
        await using var reader = await cur.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
            return (false, "Role not found.");
        var code = reader.GetString(0);
        await reader.CloseAsync();

        // Protected roles: employee (ESS portal) + admin (must always remain)
        if (string.Equals(code, "employee", StringComparison.OrdinalIgnoreCase))
            return (false, "The Employee role cannot be deleted.");
        if (string.Equals(code, "admin", StringComparison.OrdinalIgnoreCase))
            return (false, "The Admin role cannot be deleted.");

        // Detach users from this role row (keep users.role text so existing logins still work)
        await using var detach = new NpgsqlCommand(
            "UPDATE users SET role_id = NULL WHERE role_id = @id", conn);
        detach.Parameters.AddWithValue("id", roleId);
        await detach.ExecuteNonQueryAsync(ct);

        await using var del = new NpgsqlCommand("DELETE FROM roles WHERE id = @id", conn);
        del.Parameters.AddWithValue("id", roleId);
        var n = await del.ExecuteNonQueryAsync(ct);
        return n > 0 ? (true, null) : (false, "Role not found.");
    }

    public async Task<IReadOnlyList<PermissionDto>> ListPermissionsAsync(CancellationToken ct = default)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            SELECT id, code, name, group_code, group_name, parent_code, path, sort_order
            FROM permissions
            ORDER BY sort_order, id
            """,
            conn);

        var list = new List<PermissionDto>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            list.Add(ReadPermission(reader));
        }
        return list;
    }

    public async Task<PermissionMatrixDto> GetPermissionMatrixAsync(CancellationToken ct = default)
    {
        var allRoles = await ListRolesAsync(ct);
        var matrixRoles = allRoles
            .Where(r =>
            {
                var code = r.Code;
                return !string.Equals(code, "employee", StringComparison.OrdinalIgnoreCase);
            })
            .ToList();
        var permissions = await ListPermissionsAsync(ct);
        var grants = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            SELECT LOWER(r.code), p.code
            FROM role_permissions rp
            JOIN roles r ON r.id = rp.role_id
            JOIN permissions p ON p.id = rp.permission_id
            WHERE LOWER(r.code) <> 'employee'
            ORDER BY r.code, p.sort_order
            """,
            conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var role = reader.GetString(0);
            var perm = reader.GetString(1);
            if (!grants.TryGetValue(role, out var list))
            {
                list = new List<string>();
                grants[role] = list;
            }
            list.Add(perm);
        }

        foreach (var role in matrixRoles)
        {
            if (!grants.ContainsKey(role.Code))
                grants[role.Code] = new List<string>();
        }

        return new PermissionMatrixDto
        {
            Roles = matrixRoles,
            Permissions = permissions,
            Grants = grants,
        };
    }

    public async Task<(bool Ok, string? Error)> SavePermissionMatrixAsync(
        SavePermissionMatrixRequest req, CancellationToken ct = default)
    {
        if (req.Grants is null || req.Grants.Count == 0)
            return (false, "Nothing to save.");

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        try
        {
            // Resolve role ids once
            var roleIds = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            await using (var roleCmd = new NpgsqlCommand(
                "SELECT id, LOWER(code) FROM roles WHERE LOWER(code) <> 'employee'", conn, tx))
            await using (var roleReader = await roleCmd.ExecuteReaderAsync(ct))
            {
                while (await roleReader.ReadAsync(ct))
                    roleIds[roleReader.GetString(1)] = roleReader.GetInt32(0);
            }

            // Resolve permission codes → ids once
            var permIds = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            await using (var permCmd = new NpgsqlCommand("SELECT id, code FROM permissions", conn, tx))
            await using (var permReader = await permCmd.ExecuteReaderAsync(ct))
            {
                while (await permReader.ReadAsync(ct))
                    permIds[permReader.GetString(1)] = permReader.GetInt32(0);
            }

            var pairs = new List<(int RoleId, int PermId)>();
            var touchedRoleIds = new HashSet<int>();

            foreach (var (roleCodeRaw, codes) in req.Grants)
            {
                var roleCode = (roleCodeRaw ?? string.Empty).Trim().ToLowerInvariant();
                if (string.IsNullOrEmpty(roleCode) || roleCode is "employee")
                    continue;
                if (!roleIds.TryGetValue(roleCode, out var roleId))
                    return (false, $"Unknown role: {roleCode}");

                touchedRoleIds.Add(roleId);
                foreach (var raw in codes ?? new List<string>())
                {
                    var permCode = (raw ?? string.Empty).Trim();
                    if (permCode.Length == 0) continue;
                    if (!permIds.TryGetValue(permCode, out var permId))
                    {
                        // case-insensitive fallback
                        var hit = permIds.FirstOrDefault(kv =>
                            string.Equals(kv.Key, permCode, StringComparison.OrdinalIgnoreCase));
                        if (hit.Key is null) continue;
                        permId = hit.Value;
                    }
                    pairs.Add((roleId, permId));
                }
            }

            if (touchedRoleIds.Count > 0)
            {
                await using var del = new NpgsqlCommand(
                    "DELETE FROM role_permissions WHERE role_id = ANY(@ids)", conn, tx);
                del.Parameters.AddWithValue("ids", touchedRoleIds.ToArray());
                await del.ExecuteNonQueryAsync(ct);
            }

            if (pairs.Count > 0)
            {
                var distinct = pairs.Distinct().ToList();
                await using var ins = new NpgsqlCommand(
                    """
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT * FROM UNNEST(@roleIds, @permIds)
                    ON CONFLICT DO NOTHING
                    """,
                    conn, tx);
                ins.Parameters.AddWithValue("roleIds", distinct.Select(p => p.RoleId).ToArray());
                ins.Parameters.AddWithValue("permIds", distinct.Select(p => p.PermId).ToArray());
                await ins.ExecuteNonQueryAsync(ct);
            }

            await tx.CommitAsync(ct);
            return (true, null);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync(ct);
            return (false, ex.Message);
        }
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
                    WHEN LOWER(u.role) = 'employee' THEN 'employee'
                    ELSE 'admin'
                  END) IN ('admin', 'users')
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
        if (roleCode is "employee")
            return (null, "Cannot assign Employee from Settings → Users.");

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        await using var roleCmd = new NpgsqlCommand(
            "SELECT id, name, portal FROM roles WHERE LOWER(code) = @code LIMIT 1", conn);
        roleCmd.Parameters.AddWithValue("code", roleCode);
        await using var roleReader = await roleCmd.ExecuteReaderAsync(ct);
        if (!await roleReader.ReadAsync(ct))
            return (null, "Unknown role. Roles must exist in the database.");
        var roleId = roleReader.GetInt32(0);
        var roleName = roleReader.GetString(1);
        var portal = roleReader.GetString(2);
        await roleReader.CloseAsync();

        if (!string.Equals(portal, "admin", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(portal, "users", StringComparison.OrdinalIgnoreCase))
            return (null, "Only Admin portal roles can be assigned here. Employees stay on the Employee portal.");

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
            "SELECT role, COALESCE(is_active, TRUE), LOWER(email) FROM users WHERE id = @id", conn);
        cur.Parameters.AddWithValue("id", userId);
        await using var curReader = await cur.ExecuteReaderAsync(ct);
        if (!await curReader.ReadAsync(ct))
            return (null, "User not found.");
        var currentRole = curReader.GetString(0);
        var currentEmail = curReader.IsDBNull(2) ? "" : curReader.GetString(2);
        await curReader.CloseAsync();

        if (string.Equals(currentRole, "employee", StringComparison.OrdinalIgnoreCase))
            return (null, "Employee accounts are managed from Employees, not Settings → Users.");
        if (string.Equals(currentEmail, "admin@digitaldive.net", StringComparison.OrdinalIgnoreCase))
            return (null, "The primary Super Admin account cannot be edited.");

        string? roleCode = null;
        int? roleId = null;
        string? roleName = null;
        string? portal = null;

        if (!string.IsNullOrWhiteSpace(req.RoleCode))
        {
            roleCode = req.RoleCode.Trim().ToLowerInvariant();
            if (roleCode is "employee")
                return (null, "Cannot assign Employee from Settings → Users.");

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

            if (!string.Equals(portal, "admin", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(portal, "users", StringComparison.OrdinalIgnoreCase))
                return (null, "Only Admin portal roles can be assigned here.");
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

        string? email = null;
        if (!string.IsNullOrWhiteSpace(req.Email))
        {
            email = req.Email.Trim().ToLowerInvariant();
            if (!email.Contains('@'))
                return (null, "A valid email is required.");
            await using var emailTaken = new NpgsqlCommand(
                "SELECT 1 FROM users WHERE LOWER(email) = @email AND id <> @id LIMIT 1", conn);
            emailTaken.Parameters.AddWithValue("email", email);
            emailTaken.Parameters.AddWithValue("id", userId);
            if (await emailTaken.ExecuteScalarAsync(ct) is not null)
                return (null, "A user with this email already exists.");
        }

        await using var update = new NpgsqlCommand(
            """
            UPDATE users SET
              email = COALESCE(@email, email),
              display_name = COALESCE(@display, display_name),
              role = COALESCE(@role, role),
              role_id = COALESCE(@roleId, role_id),
              is_active = COALESCE(@active, is_active)
            WHERE id = @id
            """,
            conn);
        update.Parameters.AddWithValue("id", userId);
        update.Parameters.AddWithValue("email", (object?)email ?? DBNull.Value);
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

    public async Task<(bool Ok, string? Error)> DeleteUserAsync(int userId, CancellationToken ct = default)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        await using var cur = new NpgsqlCommand(
            "SELECT role FROM users WHERE id = @id", conn);
        cur.Parameters.AddWithValue("id", userId);
        var role = await cur.ExecuteScalarAsync(ct) as string;
        if (role is null) return (false, "User not found.");
        if (string.Equals(role, "employee", StringComparison.OrdinalIgnoreCase))
            return (false, "Employee accounts are managed from Employees.");

        await using var emailCmd = new NpgsqlCommand(
            "SELECT LOWER(email) FROM users WHERE id = @id", conn);
        emailCmd.Parameters.AddWithValue("id", userId);
        var email = await emailCmd.ExecuteScalarAsync(ct) as string;
        if (string.Equals(email, "admin@digitaldive.net", StringComparison.OrdinalIgnoreCase))
            return (false, "The primary Super Admin account cannot be deleted.");

        await using var del = new NpgsqlCommand("DELETE FROM users WHERE id = @id", conn);
        del.Parameters.AddWithValue("id", userId);
        var n = await del.ExecuteNonQueryAsync(ct);
        return n > 0 ? (true, null) : (false, "User not found.");
    }

    private static PermissionDto ReadPermission(NpgsqlDataReader reader) => new()
    {
        Id = reader.GetInt32(0),
        Code = reader.GetString(1),
        Name = reader.GetString(2),
        GroupCode = reader.GetString(3),
        GroupName = reader.GetString(4),
        ParentCode = reader.IsDBNull(5) ? null : reader.GetString(5),
        Path = reader.IsDBNull(6) ? null : reader.GetString(6),
        SortOrder = reader.GetInt32(7),
    };
}
