using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Approvals")]
[Route("api/approvals")]
[Authorize(Roles = "admin,manager")]
public sealed class ApprovalsController : ControllerBase
{
    private readonly HrQueryService _hr;

    public ApprovalsController(HrQueryService hr) => _hr = hr;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await _hr.ApprovalsAsync(ct));

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status)) return BadRequest(new { error = "status required" });
        var row = await _hr.UpdateApprovalAsync(id, body.Status, ct);
        return row is null ? NotFound() : Ok(row);
    }
}
