using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Attendance")]
[Route("api/attendance")]
[Authorize(Roles = "admin,manager,employee")]
public sealed class AttendanceController : ControllerBase
{
    private readonly HrQueryService _hr;

    public AttendanceController(HrQueryService hr) => _hr = hr;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        int? only = CurrentUser.IsEmployee(User) ? CurrentUser.EmployeeId(User) : null;
        if (CurrentUser.IsEmployee(User) && only is null)
            return Forbid();
        return Ok(await _hr.AttendanceAsync(only, ct));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] AttendanceCreateRequest body, CancellationToken ct)
    {
        var employeeId = body.EmployeeId;
        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null || self.Value != employeeId) return Forbid();
        }

        if (string.IsNullOrWhiteSpace(body.WorkDate))
            return BadRequest(new { error = "workDate required" });

        var row = await _hr.CreateAttendanceAsync(
            employeeId, body.WorkDate, body.CheckIn, body.CheckOut, body.Status,
            body.OvertimeHours, body.ShiftName, ct);
        return CreatedAtAction(nameof(List), row);
    }
}
