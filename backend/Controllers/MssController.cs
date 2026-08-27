using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Mss")]
[Route("api/mss")]
[Authorize(Roles = "admin,manager")]
public sealed class MssController : ControllerBase
{
    private readonly HrQueryService _hr;

    public MssController(HrQueryService hr) => _hr = hr;

    private IActionResult? ResolveManagerId(int? managerIdQuery, out int managerId)
    {
        managerId = 0;
        if (managerIdQuery is > 0)
        {
            if (!CurrentUser.IsAdmin(User))
                return Forbid();
            managerId = managerIdQuery.Value;
            return null;
        }

        var self = CurrentUser.EmployeeId(User);
        if (self is null or <= 0)
            return BadRequest(new { error = "manager employee profile required" });

        managerId = self.Value;
        return null;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] int? managerId, CancellationToken ct)
    {
        if (ResolveManagerId(managerId, out var mid) is { } err) return err;
        return Ok(await _hr.MssSummaryAsync(mid, ct));
    }

    [HttpGet("team")]
    public async Task<IActionResult> Team([FromQuery] int? managerId, CancellationToken ct)
    {
        if (ResolveManagerId(managerId, out var mid) is { } err) return err;
        return Ok(await _hr.MssTeamAsync(mid, ct));
    }

    [HttpGet("leave")]
    public async Task<IActionResult> Leave([FromQuery] int? managerId, CancellationToken ct)
    {
        if (ResolveManagerId(managerId, out var mid) is { } err) return err;
        return Ok(await _hr.MssLeaveAsync(mid, ct));
    }

    [HttpGet("attendance")]
    public async Task<IActionResult> Attendance([FromQuery] int? managerId, CancellationToken ct)
    {
        if (ResolveManagerId(managerId, out var mid) is { } err) return err;
        return Ok(await _hr.MssAttendanceAsync(mid, ct));
    }

    [HttpGet("approvals")]
    public async Task<IActionResult> Approvals([FromQuery] int? managerId, CancellationToken ct)
    {
        if (ResolveManagerId(managerId, out var mid) is { } err) return err;
        return Ok(await _hr.MssApprovalsAsync(mid, ct));
    }

    [HttpPatch("approvals/{id:int}")]
    public async Task<IActionResult> UpdateApproval(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });

        var self = CurrentUser.EmployeeId(User);
        if (CurrentUser.IsManager(User) && self is null)
            return BadRequest(new { error = "manager employee profile required" });

        // Admins can update any; managers only team approvals
        if (CurrentUser.IsManager(User) && !CurrentUser.IsAdmin(User))
        {
            var ok = await _hr.IsApprovalForManagerAsync(id, self!.Value, ct);
            if (!ok) return Forbid();
        }

        var row = await _hr.UpdateApprovalAsync(id, body.Status.Trim(), ct);
        return row is null ? NotFound() : Ok(row);
    }
}
