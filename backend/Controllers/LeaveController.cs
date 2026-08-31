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

    [HttpGet("balances")]
    public async Task<IActionResult> Balances(CancellationToken ct)
    {
        int? only = CurrentUser.IsEmployee(User) ? CurrentUser.EmployeeId(User) : null;
        if (CurrentUser.IsEmployee(User) && only is null) return Forbid();
        return Ok(await _hr.LeaveBalancesAsync(only, ct));
    }

    [HttpGet("team/summary")]
    public async Task<IActionResult> TeamSummary(CancellationToken ct)
    {
        var self = CurrentUser.EmployeeId(User);
        if (self is null or <= 0)
            return Ok(new { isTeamLead = false, teamCount = 0, pendingApprovals = 0 });

        var teamCount = await _hr.DirectReportsCountAsync(self.Value, ct);
        if (teamCount == 0)
            return Ok(new { isTeamLead = false, teamCount = 0, pendingApprovals = 0 });

        var pending = await _hr.TeamPendingApprovalsCountAsync(self.Value, ct);
        return Ok(new { isTeamLead = true, teamCount, pendingApprovals = pending });
    }

    [HttpGet("team/approvals")]
    public async Task<IActionResult> TeamApprovals(CancellationToken ct)
    {
        var self = CurrentUser.EmployeeId(User);
        if (self is null or <= 0) return Forbid();
        if (!await _hr.HasDirectReportsAsync(self.Value, ct)) return Forbid();
        return Ok(await _hr.TeamPendingLeaveApprovalsAsync(self.Value, ct));
    }

    [HttpPatch("team/approvals/{id:int}")]
    public async Task<IActionResult> TeamApprovalDecision(int id, [FromBody] ApprovalDecisionRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });

        var status = body.Status.Trim().ToLowerInvariant();
        if (status is not ("approved" or "rejected"))
            return BadRequest(new { error = "status must be approved or rejected" });

        var self = CurrentUser.EmployeeId(User);
        if (self is null or <= 0) return Forbid();

        var row = await _hr.TeamLeaveApprovalDecisionAsync(id, self.Value, status, body.Note, ct);
        return row is null ? NotFound() : Ok(row);
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

        var (row, error) = await _hr.CreateLeaveAsync(
            employeeId, body.LeaveType, body.StartDate, body.EndDate, body.Days, body.Reason, ct);
        if (error is not null) return BadRequest(new { error });
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
