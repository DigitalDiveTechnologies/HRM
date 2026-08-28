using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Audit")]
[Route("api/audit")]
[Authorize(Roles = "admin,manager")]
public sealed class AuditController : ControllerBase
{
    private readonly HrQueryService _hr;
    public AuditController(HrQueryService hr) => _hr = hr;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await _hr.AuditLogsAsync(ct));

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create([FromBody] AuditLogCreateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Action))
            return BadRequest(new { error = "action required" });
        var email = CurrentUser.Email(User) ?? User.Identity?.Name;
        var role = CurrentUser.Role(User);
        await _hr.WriteAuditAsync(email, role, body.Action.Trim(), body.EntityType, body.EntityId, body.Detail, ct);
        return StatusCode(StatusCodes.Status201Created, new { ok = true });
    }
}
