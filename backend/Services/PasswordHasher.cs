namespace DigitalDive.Hr.Api.Services;

public static class PasswordHasher
{
    public static bool IsHashed(string? stored) =>
        !string.IsNullOrEmpty(stored)
        && (stored.StartsWith("$2a$", StringComparison.Ordinal)
            || stored.StartsWith("$2b$", StringComparison.Ordinal)
            || stored.StartsWith("$2y$", StringComparison.Ordinal));

    public static string Hash(string plainPassword) =>
        BCrypt.Net.BCrypt.HashPassword(plainPassword, workFactor: 11);

    public static bool Verify(string stored, string provided)
    {
        if (string.IsNullOrEmpty(stored) || provided is null) return false;

        if (IsHashed(stored))
        {
            try
            {
                return BCrypt.Net.BCrypt.Verify(provided, stored);
            }
            catch
            {
                return false;
            }
        }

        // Legacy plaintext — migrate away via HashAll / login upgrade.
        return string.Equals(stored, provided, StringComparison.Ordinal);
    }
}
