using DigitalDive.Hr.Api.Data;
using DigitalDive.Hr.Api.Models;
using Npgsql;

namespace DigitalDive.Hr.Api.Services;

public sealed class AuthService
{
    private readonly Db _db;

    public AuthService(Db db)
    {
        _db = db;
    }

    public async Task<(UserRecord? User, string? Error)> ValidateLoginAsync(
        string email, string password, CancellationToken ct = default)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        UserRecord? user = null;
        try
        {
            await using var cmd = new NpgsqlCommand(
                """
                SELECT u.id, u.email, u.password, u.role, u.employee_id, e.full_name, e.job_title,
                       COALESCE(u.is_active, TRUE) AS is_active,
                       COALESCE(NULLIF(u.display_name, ''), e.full_name) AS display_name
                FROM users u
                LEFT JOIN employees e ON e.id = u.employee_id
                WHERE LOWER(u.email) = LOWER(@email)
                LIMIT 1
                """,
                conn);
            cmd.Parameters.AddWithValue("email", email.Trim());
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                user = new UserRecord
                {
                    Id = reader.GetInt32(0),
                    Email = reader.GetString(1),
                    Password = reader.GetString(2),
                    Role = reader.GetString(3),
                    EmployeeId = reader.IsDBNull(4) ? null : reader.GetInt32(4),
                    FullName = reader.IsDBNull(8) ? (reader.IsDBNull(5) ? null : reader.GetString(5)) : reader.GetString(8),
                    JobTitle = reader.IsDBNull(6) ? null : reader.GetString(6),
                    PreferredLocale = "en",
                    IsActive = reader.GetBoolean(7),
                };
            }
        }
        catch (PostgresException ex) when (ex.SqlState == "42703")
        {
            // Pre-RBAC schema: is_active / display_name not yet applied
            await using var cmd = new NpgsqlCommand(
                """
                SELECT u.id, u.email, u.password, u.role, u.employee_id, e.full_name, e.job_title
                FROM users u
                LEFT JOIN employees e ON e.id = u.employee_id
                WHERE LOWER(u.email) = LOWER(@email)
                LIMIT 1
                """,
                conn);
            cmd.Parameters.AddWithValue("email", email.Trim());
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                user = new UserRecord
                {
                    Id = reader.GetInt32(0),
                    Email = reader.GetString(1),
                    Password = reader.GetString(2),
                    Role = reader.GetString(3),
                    EmployeeId = reader.IsDBNull(4) ? null : reader.GetInt32(4),
                    FullName = reader.IsDBNull(5) ? null : reader.GetString(5),
                    JobTitle = reader.IsDBNull(6) ? null : reader.GetString(6),
                    PreferredLocale = "en",
                    IsActive = true,
                };
            }
        }

        if (user is null)
            return (null, "Invalid email or password.");

        password = password.Trim();

        if (!PasswordHasher.Verify(user.Password, password))
            return (null, "Invalid email or password.");

        if (!user.IsActive)
            return (null, "This account is inactive. Ask your admin to activate it again.");

        // Preferred locale + portal from roles (best-effort; missing columns/tables won't block login)
        try
        {
            await using var locCmd = new NpgsqlCommand(
                "SELECT COALESCE(NULLIF(preferred_locale, ''), 'en') FROM users WHERE id = @id", conn);
            locCmd.Parameters.AddWithValue("id", user.Id);
            var loc = await locCmd.ExecuteScalarAsync(ct) as string;
            if (!string.IsNullOrWhiteSpace(loc)) user.PreferredLocale = loc;
        }
        catch (PostgresException)
        {
            user.PreferredLocale = "en";
        }

        try
        {
            await using var portalCmd = new NpgsqlCommand(
                """
                SELECT portal FROM roles
                WHERE id = (SELECT role_id FROM users WHERE id = @id)
                   OR LOWER(code) = LOWER(@role)
                LIMIT 1
                """,
                conn);
            portalCmd.Parameters.AddWithValue("id", user.Id);
            portalCmd.Parameters.AddWithValue("role", user.Role);
            user.Portal = await portalCmd.ExecuteScalarAsync(ct) as string;
            if (string.Equals(user.Portal, "users", StringComparison.OrdinalIgnoreCase)
                || (user.Portal is null && string.Equals(user.Role, "super_admin", StringComparison.OrdinalIgnoreCase)))
            {
                user.Portal = "admin";
            }
        }
        catch (PostgresException)
        {
            user.Portal = null;
        }

        // Upgrade legacy plaintext passwords to BCrypt after successful login.
        if (!PasswordHasher.IsHashed(user.Password))
        {
            var hash = PasswordHasher.Hash(password);
            await using var upgrade = new NpgsqlCommand(
                "UPDATE users SET password = @hash WHERE id = @id", conn);
            upgrade.Parameters.AddWithValue("hash", hash);
            upgrade.Parameters.AddWithValue("id", user.Id);
            await upgrade.ExecuteNonQueryAsync(ct);
            user.Password = hash;
        }

        return (user, null);
    }

    public async Task<bool> IsUserActiveAsync(int userId, CancellationToken ct = default)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        try
        {
            await using var cmd = new NpgsqlCommand(
                "SELECT COALESCE(is_active, TRUE) FROM users WHERE id = @id", conn);
            cmd.Parameters.AddWithValue("id", userId);
            var result = await cmd.ExecuteScalarAsync(ct);
            if (result is null || result is DBNull) return false;
            return Convert.ToBoolean(result);
        }
        catch (PostgresException ex) when (ex.SqlState == "42703")
        {
            // Column missing — treat as active
            return true;
        }
    }

    public async Task<(bool Ok, string? Error)> ChangePasswordAsync(
        int userId, string currentPassword, string newPassword, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 6)
        {
            return (false, "New password must be at least 6 characters.");
        }

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        await using var select = new NpgsqlCommand(
            "SELECT password FROM users WHERE id = @id", conn);
        select.Parameters.AddWithValue("id", userId);
        var stored = await select.ExecuteScalarAsync(ct) as string;
        if (stored is null) return (false, "User not found.");
        if (!PasswordHasher.Verify(stored, currentPassword)) return (false, "Current password is incorrect.");

        var hash = PasswordHasher.Hash(newPassword);
        await using var update = new NpgsqlCommand(
            "UPDATE users SET password = @hash WHERE id = @id", conn);
        update.Parameters.AddWithValue("hash", hash);
        update.Parameters.AddWithValue("id", userId);
        await update.ExecuteNonQueryAsync(ct);
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> UpdatePreferredLocaleAsync(int userId, string locale, CancellationToken ct = default)
    {
        var loc = string.Equals(locale?.Trim(), "ar", StringComparison.OrdinalIgnoreCase) ? "ar" : "en";
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        try
        {
            await using var update = new NpgsqlCommand(
                "UPDATE users SET preferred_locale = @loc WHERE id = @id", conn);
            update.Parameters.AddWithValue("loc", loc);
            update.Parameters.AddWithValue("id", userId);
            var n = await update.ExecuteNonQueryAsync(ct);
            return n > 0 ? (true, null) : (false, "User not found.");
        }
        catch (PostgresException ex) when (ex.SqlState == "42703")
        {
            return (false, "preferred_locale column missing — apply schema-phase3-locale.sql");
        }
    }

    /// <summary>One-time / ops: hash every plaintext password in users table.</summary>
    public async Task<int> HashAllPlaintextPasswordsAsync(CancellationToken ct = default)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        await using var list = new NpgsqlCommand("SELECT id, password FROM users", conn);
        await using var reader = await list.ExecuteReaderAsync(ct);
        var upgrades = new List<(int Id, string Hash)>();
        while (await reader.ReadAsync(ct))
        {
            var id = reader.GetInt32(0);
            var password = reader.GetString(1);
            if (!PasswordHasher.IsHashed(password))
            {
                upgrades.Add((id, PasswordHasher.Hash(password)));
            }
        }

        await reader.CloseAsync();

        foreach (var (id, hash) in upgrades)
        {
            await using var update = new NpgsqlCommand(
                "UPDATE users SET password = @hash WHERE id = @id", conn);
            update.Parameters.AddWithValue("hash", hash);
            update.Parameters.AddWithValue("id", id);
            await update.ExecuteNonQueryAsync(ct);
        }

        return upgrades.Count;
    }
}
