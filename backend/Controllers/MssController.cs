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

    private async Task<(IActionResult? Err, int ManagerId)> ResolveManagerIdAsync(
        int? managerIdQuery, CancellationToken ct)
    {
        if (managerIdQuery is > 0)
        {
            if (!CurrentUser.IsAdmin(User))
                return (Forbid(), 0);
            return (null, managerIdQuery.Value);
        }

        var self = CurrentUser.EmployeeId(User);
        if (self is > 0)
            return (null, self.Value);

        // Super Admin / Admin can open MSS without a linked employee — empty team view
        if (CurrentUser.IsAdmin(User))
            return (null, 0);

        // Manager (or similar) without employee_id — auto-create/link a profile so MSS works
        if (CurrentUser.IsManager(User)
            && int.TryParse(CurrentUser.UserId(User), out var userId)
            && !string.IsNullOrWhiteSpace(CurrentUser.Email(User)))
        {
            var linked = await _hr.EnsurePortalEmployeeLinkAsync(
                userId,
                CurrentUser.Email(User)!,
                CurrentUser.Name(User),
                ct);
            if (linked is > 0)
                return (null, linked.Value);
        }

        return (BadRequest(new { error = "manager employee profile required" }), 0);
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] int? managerId, CancellationToken ct)
    {
        var (err, mid) = await ResolveManagerIdAsync(managerId, ct);
        if (err is not null) return err;
        return Ok(await _hr.MssSummaryAsync(mid, ct));
    }

    [HttpGet("team")]
    public async Task<IActionResult> Team([FromQuery] int? managerId, CancellationToken ct)
    {
        var (err, mid) = await ResolveManagerIdAsync(managerId, ct);
        if (err is not null) return err;
        return Ok(await _hr.MssTeamAsync(mid, ct));
    }

    [HttpGet("leave")]
    public async Task<IActionResult> Leave([FromQuery] int? managerId, CancellationToken ct)
    {
        var (err, mid) = await ResolveManagerIdAsync(managerId, ct);
        if (err is not null) return err;
        return Ok(await _hr.MssLeaveAsync(mid, ct));
    }

    [HttpGet("attendance")]
    public async Task<IActionResult> Attendance([FromQuery] int? managerId, CancellationToken ct)
    {
        var (err, mid) = await ResolveManagerIdAsync(managerId, ct);
        if (err is not null) return err;
        return Ok(await _hr.MssAttendanceAsync(mid, ct));
    }

    [HttpGet("approvals")]
    public async Task<IActionResult> Approvals([FromQuery] int? managerId, CancellationToken ct)
    {
        var (err, mid) = await ResolveManagerIdAsync(managerId, ct);
        if (err is not null) return err;
        return Ok(await _hr.MssApprovalsAsync(mid, ct));
    }

    [HttpPatch("approvals/{id:int}")]
    public async Task<IActionResult> UpdateApproval(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });

        var self = CurrentUser.EmployeeId(User);
        if (CurrentUser.IsManager(User) && self is null)
        {
            if (int.TryParse(CurrentUser.UserId(User), out var userId)
                && !string.IsNullOrWhiteSpace(CurrentUser.Email(User)))
            {
                self = await _hr.EnsurePortalEmployeeLinkAsync(
                    userId,
                    CurrentUser.Email(User)!,
                    CurrentUser.Name(User),
                    ct);
            }
            if (self is null)
                return BadRequest(new { error = "manager employee profile required" });
        }

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
