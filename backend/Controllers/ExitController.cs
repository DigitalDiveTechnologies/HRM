using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Exit")]
[Route("api/exit")]
[Authorize]
public sealed class ExitController : ControllerBase
{
    private readonly HrQueryService _hr;
    private readonly RbacService _rbac;

    public ExitController(HrQueryService hr, RbacService rbac)
    {
        _hr = hr;
        _rbac = rbac;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "exit.view")) return Forbid();
        return Ok(await _hr.ExitCasesAsync(ct));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ExitCaseCreateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "exit.view")) return Forbid();
        if (body.EmployeeId <= 0)
            return BadRequest(new { error = "employeeId required" });

        var row = await _hr.CreateExitCaseAsync(
            body.EmployeeId, body.ExitType, body.Reason, body.NoticeDate,
            body.LastWorkingDate, body.SettlementNotes, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpGet("{id:int}/checklist")]
    public async Task<IActionResult> Checklist(int id, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "exit.view")) return Forbid();
        return Ok(await _hr.ExitChecklistAsync(id, ct));
    }

    [HttpPatch("checklist/{id:int}")]
    public async Task<IActionResult> UpdateChecklist(int id, [FromBody] ExitChecklistUpdateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "exit.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });
        var row = await _hr.UpdateExitChecklistAsync(id, body.Status, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "exit.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });
        var row = await _hr.UpdateExitCaseStatusAsync(id, body.Status, ct);
        return row is null ? NotFound() : Ok(row);
    }
}
