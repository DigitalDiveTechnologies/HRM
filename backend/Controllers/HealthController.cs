using DigitalDive.Hr.Api.Data;
using DigitalDive.Hr.Api.Services;
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
    private readonly OpsScaleService _ops;

    public HealthController(Db db, OpsScaleService ops)
    {
        _db = db;
        _ops = ops;
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
            return Ok(new
            {
                ok = true,
                db = true,
                stack = ".NET 10",
                phase = "5-scale",
                utc = DateTime.UtcNow.ToString("o")
            });
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { ok = false, db = false, error = ex.Message });
        }
    }

    /// <summary>Readiness probe — DB + critical schema presence (Phase 5 observability).</summary>
    [AllowAnonymous]
    [HttpGet("ready")]
    public async Task<IActionResult> Ready(CancellationToken ct)
    {
        var payload = await _ops.ReadyAsync(ct);
        var readyProp = payload.GetType().GetProperty("ready")?.GetValue(payload);
        var ready = readyProp is true;
        return ready ? Ok(payload) : StatusCode(503, payload);
    }
}
