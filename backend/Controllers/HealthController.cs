using DigitalDive.Hr.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Health")]
[Route("api/health")]
public sealed class HealthController : ControllerBase
{
    private readonly Db _db;

    public HealthController(Db db)
    {
        _db = db;
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!_db.HasConnectionString)
        {
            return StatusCode(503, new { ok = false, db = false, error = "Connection string not configured." });
        }

        try
        {
            await using var conn = _db.CreateConnection();
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand("SELECT 1", conn);
            await cmd.ExecuteScalarAsync(ct);
            return Ok(new { ok = true, db = true, stack = ".NET 10" });
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { ok = false, db = false, error = ex.Message });
        }
    }
}
