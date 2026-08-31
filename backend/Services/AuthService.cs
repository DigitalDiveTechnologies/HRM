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

    public async Task<UserRecord?> ValidateLoginAsync(string email, string password, CancellationToken ct = default)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

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

        password = password.Trim();

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        var user = new UserRecord
        {
            Id = reader.GetInt32(0),
            Email = reader.GetString(1),
            Password = reader.GetString(2),
            Role = reader.GetString(3),
            EmployeeId = reader.IsDBNull(4) ? null : reader.GetInt32(4),
            FullName = reader.IsDBNull(5) ? null : reader.GetString(5),
            JobTitle = reader.IsDBNull(6) ? null : reader.GetString(6),
        };

        await reader.CloseAsync();

        if (!PasswordHasher.Verify(user.Password, password))
        {
            return null;
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

        return user;
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
