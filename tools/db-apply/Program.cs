using Microsoft.Extensions.Configuration;
using Npgsql;
using System.Text.RegularExpressions;

// Versioned apply order — Blueprint Phase 1 org foundation included (safe IF NOT EXISTS).
var files = args.Length > 0
    ? args
    : new[]
    {
        "schema-core.sql",
        "schema-divisions.sql",
        "schema-employee-master.sql",
        "schema-employee-photo.sql",
        "schema-leave-workflow.sql",
        "schema-certificates.sql",
        "schema-payroll-division.sql",
        "schema-extensions.sql",
        "seed-extensions.sql",
        "schema-deep-features.sql",
        "seed-deep-features.sql",
        "schema-org-foundation.sql",
        "migrate-org-positions.sql",
        "schema-payroll-control.sql",
        "seed-payroll-control.sql",
        "schema-payroll-phase2.sql",
        "schema-phase3-locale.sql",
        "schema-audit-ensure.sql",
        "schema-onboarding-tasks.sql",
        "schema-phase5-scale.sql",
        "schema-masters.sql",
        "seed-masters.sql",
        "schema-rbac.sql",
        "seed-rbac.sql",
        "seed-rbac-extra-roles.sql",
        "schema-rbac-permissions.sql",
        "seed-rbac-permissions.sql",
        "schema-rbac-custom-roles.sql",
        "seed-admin-digitaldive-net.sql",
        "seed-divisions.sql",
    };

string? FindApiDir()
{
    var dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir != null)
    {
        var candidate = Path.Combine(dir.FullName, "backend");
        if (Directory.Exists(Path.Combine(candidate, "db")))
            return candidate;
        dir = dir.Parent;
    }
    return null;
}

var apiDir = FindApiDir();
if (apiDir is null)
{
    Console.Error.WriteLine($"Cannot locate backend/db from {AppContext.BaseDirectory}");
    return 1;
}
var dbDir = Path.Combine(apiDir, "db");

var config = new ConfigurationBuilder()
    .SetBasePath(apiDir)
    .AddJsonFile("appsettings.json", optional: true)
    .AddJsonFile("appsettings.Development.json", optional: true)
    .AddUserSecrets("1045f3f0-ed29-435e-abaf-734271740079")
    .AddEnvironmentVariables()
    .Build();

var raw = Environment.GetEnvironmentVariable("DATABASE_URL")
          ?? config.GetConnectionString("Neon");

if (string.IsNullOrWhiteSpace(raw))
{
    Console.Error.WriteLine("No DATABASE_URL / ConnectionStrings:Neon found.");
    return 1;
}

var connStr = Normalize(raw);
await using var conn = new NpgsqlConnection(connStr);
await conn.OpenAsync();

if (args.Length > 1 && args[0] == "-q")
{
    var query = string.Join(" ", args.Skip(1));
    await using var qCmd = new NpgsqlCommand(query, conn);
    if (query.TrimStart().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase) ||
        query.TrimStart().StartsWith("WITH", StringComparison.OrdinalIgnoreCase))
    {
        await using var reader = await qCmd.ExecuteReaderAsync();
        for (int i = 0; i < reader.FieldCount; i++)
        {
            Console.Write(reader.GetName(i) + " | ");
        }
        Console.WriteLine();
        while (await reader.ReadAsync())
        {
            for (int i = 0; i < reader.FieldCount; i++)
            {
                Console.Write((reader.IsDBNull(i) ? "NULL" : reader.GetValue(i)?.ToString()) + " | ");
            }
            Console.WriteLine();
        }
    }
    else
    {
        var rows = await qCmd.ExecuteNonQueryAsync();
        Console.WriteLine($"Rows affected: {rows}");
    }
    return 0;
}

foreach (var file in files)
{
    var path = Path.IsPathRooted(file) ? file : Path.Combine(dbDir, Path.GetFileName(file));
    if (!File.Exists(path))
    {
        Console.Error.WriteLine($"Missing: {path}");
        return 1;
    }

    var sql = await File.ReadAllTextAsync(path);
    await using var cmd = new NpgsqlCommand(sql, conn) { CommandTimeout = 120 };
    await cmd.ExecuteNonQueryAsync();
    Console.WriteLine($"Applied {Path.GetFileName(path)}");
}

Console.WriteLine("Done.");
return 0;

static string Normalize(string value)
{
    value = value.Trim().Trim('"');
    if (!value.StartsWith("postgres", StringComparison.OrdinalIgnoreCase)) return value;

    var match = Regex.Match(
        value,
        @"^postgres(?:ql)?://(?<user>[^:]+):(?<pass>[^@]+)@(?<host>[^/:]+)(?::(?<port>\d+))?/(?<db>[^?]+)",
        RegexOptions.IgnoreCase);
    if (!match.Success) return value;

    var user = Uri.UnescapeDataString(match.Groups["user"].Value);
    var pass = Uri.UnescapeDataString(match.Groups["pass"].Value);
    var host = match.Groups["host"].Value;
    var port = match.Groups["port"].Success ? match.Groups["port"].Value : "5432";
    var db = Uri.UnescapeDataString(match.Groups["db"].Value.TrimEnd('/'));
    return $"Host={host};Port={port};Username={user};Password={pass};Database={db};SSL Mode=Require;Trust Server Certificate=true";
}
