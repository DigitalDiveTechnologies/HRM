using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "DocumentRenewals")]
[Route("api/document-renewals")]
[Authorize]
public sealed class DocumentRenewalsController : ControllerBase
{
    private readonly DocumentRenewalService _svc;
    private readonly RbacService _rbac;

    public DocumentRenewalsController(DocumentRenewalService svc, RbacService rbac)
    {
        _svc = svc;
        _rbac = rbac;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "compliance.view")) return Forbid();
        return Ok(await _svc.ListAsync(ct));
    }

    [HttpPost("sync")]
    public async Task<IActionResult> Sync(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "compliance.view")) return Forbid();
        return Ok(await _svc.SyncRenewalsAsync(ct));
    }

    public sealed class StatusBody
    {
        public string Status { get; set; } = "";
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] StatusBody body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "compliance.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });
        var row = await _svc.UpdateStatusAsync(id, body.Status, ct);
        return row is null ? NotFound() : Ok(row);
    }
}
