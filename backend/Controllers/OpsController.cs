using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Ops")]
[Route("api/ops")]
[Authorize]
public sealed class OpsController : ControllerBase
{
    private readonly OpsScaleService _ops;
    private readonly RbacService _rbac;

    public OpsController(OpsScaleService ops, RbacService rbac)
    {
        _ops = ops;
        _rbac = rbac;
    }

    [HttpGet("ready")]
    [AllowAnonymous]
    public async Task<IActionResult> Ready(CancellationToken ct) => Ok(await _ops.ReadyAsync(ct));

    [HttpGet("config")]
    public async Task<IActionResult> Config(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "ops.view")) return Forbid();
        return Ok(await _ops.ListConfigAsync(ct));
    }

    [HttpPut("config/{key}")]
    public async Task<IActionResult> UpsertConfig(string key, [FromBody] SystemConfigUpsertRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "ops.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(key))
            return BadRequest(new { error = "key required" });
        var row = await _ops.UpsertConfigAsync(key, body.Value ?? "", body.Description, CurrentUser.Email(User), ct);
        return row is null ? BadRequest(new { error = "invalid key" }) : Ok(row);
    }

    [HttpGet("jobs")]
    public async Task<IActionResult> Jobs(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "ops.view")) return Forbid();
        return Ok(await _ops.JobRunsAsync(ct));
    }

    [HttpGet("analytics")]
    public async Task<IActionResult> Analytics(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "ops.view")) return Forbid();
        return Ok(await _ops.AnalyticsPackAsync(ct));
    }

    [HttpGet("exports")]
    public async Task<IActionResult> ExportHistory(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "ops.view")) return Forbid();
        return Ok(await _ops.ExportHistoryAsync(ct));
    }
}

public sealed class SystemConfigUpsertRequest
{
    public string? Value { get; set; }
    public string? Description { get; set; }
}
