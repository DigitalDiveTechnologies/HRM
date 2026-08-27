namespace DigitalDive.Hr.Api.Data;

public sealed class Db
{
    private readonly string _connectionString;

    public Db(string connectionString)
    {
        _connectionString = Normalize(connectionString ?? string.Empty);
    }

    public bool HasConnectionString => !string.IsNullOrWhiteSpace(_connectionString);

    public Npgsql.NpgsqlConnection CreateConnection()
    {
        if (!HasConnectionString)
        {
            throw new InvalidOperationException(
                "Database connection is not configured. Run setup-db.cmd then restart the API.");
        }

        return new Npgsql.NpgsqlConnection(_connectionString);
    }

    /// <summary>
    /// Converts postgres URI → Npgsql keyword string so sslmode=require is never lost
    /// by CLI argument parsers that split on '='.
    /// </summary>
    public static string Normalize(string raw)
    {
        var value = (raw ?? string.Empty).Trim().Trim('"');
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;

        if (!value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return value;
        }

        var match = System.Text.RegularExpressions.Regex.Match(
            value,
            @"^postgres(?:ql)?://(?<user>[^:]+):(?<pass>[^@]+)@(?<host>[^/:]+)(?::(?<port>\d+))?/(?<db>[^?]+)(?:\?(?<query>.*))?$",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        if (!match.Success)
        {
            return value;
        }

        var user = Uri.UnescapeDataString(match.Groups["user"].Value);
        var pass = Uri.UnescapeDataString(match.Groups["pass"].Value);
        var host = match.Groups["host"].Value;
        var port = match.Groups["port"].Success ? match.Groups["port"].Value : "5432";
        var db = Uri.UnescapeDataString(match.Groups["db"].Value.TrimEnd('/'));
        var query = match.Groups["query"].Value;

        var sslMode = "Require";
        if (!string.IsNullOrEmpty(query))
        {
            foreach (var part in query.Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var kv = part.Split('=', 2);
                if (kv.Length == 2 && kv[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase))
                {
                    sslMode = kv[1] switch
                    {
                        "disable" => "Disable",
                        "allow" => "Allow",
                        "prefer" => "Prefer",
                        "require" => "Require",
                        "verify-ca" => "VerifyCA",
                        "verify-full" => "VerifyFull",
                        _ => "Require"
                    };
                }
            }

            // Truncated "?sslmode" (no =require) → still Require for Neon
            if (query.Equals("sslmode", StringComparison.OrdinalIgnoreCase))
            {
                sslMode = "Require";
            }
        }

        return $"Host={host};Port={port};Username={user};Password={pass};Database={db};SSL Mode={sslMode};Trust Server Certificate=true";
    }
}
