using DigitalDive.Hr.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using System.Text.Json;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[Route("api/query")]
public sealed class QueryController : ControllerBase
{
    private readonly Db _db;

    public QueryController(Db db)
    {
        _db = db;
    }

    public sealed class QueryRequest
    {
        public string? Query { get; set; }
    }

    [HttpPost("execute")]
    public async Task<IActionResult> Execute([FromBody] QueryRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body?.Query))
        {
            return BadRequest(new { error = "Query is required" });
        }

        var sql = body.Query.Trim();
        try
        {
            await using var conn = _db.CreateConnection();
            await conn.OpenAsync(ct);

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.CommandTimeout = 30;

            var isReader = sql.StartsWith("SELECT", StringComparison.OrdinalIgnoreCase) ||
                           sql.StartsWith("WITH", StringComparison.OrdinalIgnoreCase) ||
                           sql.Contains("RETURNING", StringComparison.OrdinalIgnoreCase);

            if (isReader)
            {
                await using var reader = await cmd.ExecuteReaderAsync(ct);
                var rows = new List<Dictionary<string, object?>>();
                while (await reader.ReadAsync(ct))
                {
                    var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                    for (int i = 0; i < reader.FieldCount; i++)
                    {
                        var val = reader.IsDBNull(i) ? null : reader.GetValue(i);
                        // If json/jsonb string or object, convert cleanly
                        if (val is string s && (s.StartsWith("{") || s.StartsWith("[")))
                        {
                            try
                            {
                                using var doc = JsonDocument.Parse(s);
                                row[reader.GetName(i)] = doc.RootElement.Clone();
                                continue;
                            }
                            catch { }
                        }
                        row[reader.GetName(i)] = val;
                    }
                    rows.Add(row);
                }
                return Ok(new { rows });
            }
            else
            {
                var affected = await cmd.ExecuteNonQueryAsync(ct);
                return Ok(new { rows = Array.Empty<object>(), affected });
            }
        }
        catch (PostgresException ex)
        {
            return StatusCode(500, new { error = ex.MessageText, code = ex.SqlState });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
