using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "DocumentRenewals")]
[Route("api/document-renewals")]
[Authorize(Roles = "admin,manager")]
public sealed class DocumentRenewalsController : ControllerBase
{
    private readonly DocumentRenewalService _svc;

    public DocumentRenewalsController(DocumentRenewalService svc) => _svc = svc;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await _svc.ListAsync(ct));

    [HttpPost("sync")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Sync(CancellationToken ct) => Ok(await _svc.SyncRenewalsAsync(ct));

    public sealed class StatusBody
    {
        public string Status { get; set; } = "";
    }

    [HttpPatch("{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Update(int id, [FromBody] StatusBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });
        var row = await _svc.UpdateStatusAsync(id, body.Status, ct);
        return row is null ? NotFound() : Ok(row);
    }
}
