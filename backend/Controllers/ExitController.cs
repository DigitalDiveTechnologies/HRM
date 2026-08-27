using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Exit")]
[Route("api/exit")]
[Authorize(Roles = "admin,manager")]
public sealed class ExitController : ControllerBase
{
    private readonly HrQueryService _hr;

    public ExitController(HrQueryService hr) => _hr = hr;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) =>
        Ok(await _hr.ExitCasesAsync(ct));

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create([FromBody] ExitCaseCreateRequest body, CancellationToken ct)
    {
        if (body.EmployeeId <= 0)
            return BadRequest(new { error = "employeeId required" });

        var row = await _hr.CreateExitCaseAsync(
            body.EmployeeId, body.ExitType, body.Reason, body.NoticeDate,
            body.LastWorkingDate, body.SettlementNotes, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpGet("{id:int}/checklist")]
    public async Task<IActionResult> Checklist(int id, CancellationToken ct) =>
        Ok(await _hr.ExitChecklistAsync(id, ct));

    [HttpPatch("checklist/{id:int}")]
    public async Task<IActionResult> UpdateChecklist(int id, [FromBody] ExitChecklistUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });
        var row = await _hr.UpdateExitChecklistAsync(id, body.Status, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPatch("{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });
        var row = await _hr.UpdateExitCaseStatusAsync(id, body.Status, ct);
        return row is null ? NotFound() : Ok(row);
    }
}
