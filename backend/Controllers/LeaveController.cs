using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Leave")]
[Route("api/leave")]
[Authorize(Roles = "admin,manager,employee")]
public sealed class LeaveController : ControllerBase
{
    private readonly HrQueryService _hr;

    public LeaveController(HrQueryService hr) => _hr = hr;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        int? only = CurrentUser.IsEmployee(User) ? CurrentUser.EmployeeId(User) : null;
        if (CurrentUser.IsEmployee(User) && only is null) return Forbid();
        return Ok(await _hr.LeaveAsync(only, ct));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] LeaveCreateRequest body, CancellationToken ct)
    {
        var employeeId = body.EmployeeId;
        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null || self.Value != employeeId) return Forbid();
        }

        if (string.IsNullOrWhiteSpace(body.LeaveType) || string.IsNullOrWhiteSpace(body.StartDate) || string.IsNullOrWhiteSpace(body.EndDate))
            return BadRequest(new { error = "leaveType, startDate, endDate required" });

        var row = await _hr.CreateLeaveAsync(
            employeeId, body.LeaveType, body.StartDate, body.EndDate, body.Days, body.Reason, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("{id:int}")]
    [Authorize(Roles = "admin,manager")]
    public async Task<IActionResult> Update(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status)) return BadRequest(new { error = "status required" });
        var row = await _hr.UpdateLeaveAsync(id, body.Status, ct);
        return row is null ? NotFound() : Ok(row);
    }
}
