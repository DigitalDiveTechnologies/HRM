using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Performance")]
[Route("api/performance")]
[Authorize(Roles = "admin,manager,employee")]
public sealed class PerformanceController : ControllerBase
{
    private static readonly HashSet<string> GoalStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "active", "completed", "cancelled"
    };

    private static readonly HashSet<string> ReviewTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "annual", "mid_year", "probation", "360"
    };

    private static readonly HashSet<string> ReviewStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "draft", "submitted", "acknowledged"
    };

    private readonly HrQueryService _hr;

    public PerformanceController(HrQueryService hr) => _hr = hr;

    [HttpGet("goals")]
    public async Task<IActionResult> Goals(CancellationToken ct)
    {
        int? only = CurrentUser.IsEmployee(User) ? CurrentUser.EmployeeId(User) : null;
        if (CurrentUser.IsEmployee(User) && only is null or <= 0)
            return BadRequest(new { error = "employee profile not linked" });
        return Ok(await _hr.PerformanceGoalsAsync(only, ct));
    }

    [HttpPost("goals")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateGoal([FromBody] PerformanceGoalCreateRequest body, CancellationToken ct)
    {
        if (body.EmployeeId <= 0)
            return BadRequest(new { error = "employeeId required" });
        if (string.IsNullOrWhiteSpace(body.Title))
            return BadRequest(new { error = "title required" });

        var status = string.IsNullOrWhiteSpace(body.Status) ? "active" : body.Status.Trim();
        if (!GoalStatuses.Contains(status))
            return BadRequest(new { error = "invalid status" });

        var row = await _hr.CreatePerformanceGoalAsync(
            body.EmployeeId, body.Title.Trim(), body.Kpi, body.TargetValue,
            body.ProgressPct, body.PeriodLabel, status, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("goals/{id:int}")]
    [Authorize(Roles = "admin,employee")]
    public async Task<IActionResult> UpdateGoal(int id, [FromBody] PerformanceGoalUpdateRequest body, CancellationToken ct)
    {
        if (body.ProgressPct is null && string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "progressPct or status required" });

        if (!string.IsNullOrWhiteSpace(body.Status) && !GoalStatuses.Contains(body.Status.Trim()))
            return BadRequest(new { error = "invalid status" });

        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null or <= 0) return BadRequest(new { error = "employee profile not linked" });
            if (!await _hr.PerformanceGoalOwnedByAsync(id, self.Value, ct))
                return Forbid();
            // Employees may only update progress, not cancel
            var row = await _hr.UpdatePerformanceGoalAsync(id, body.ProgressPct, null, ct);
            return row is null ? NotFound() : Ok(row);
        }

        var updated = await _hr.UpdatePerformanceGoalAsync(id, body.ProgressPct, body.Status?.Trim(), ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpGet("reviews")]
    public async Task<IActionResult> Reviews(CancellationToken ct)
    {
        int? only = CurrentUser.IsEmployee(User) ? CurrentUser.EmployeeId(User) : null;
        if (CurrentUser.IsEmployee(User) && only is null or <= 0)
            return BadRequest(new { error = "employee profile not linked" });
        return Ok(await _hr.PerformanceReviewsAsync(only, ct));
    }

    [HttpPost("reviews")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateReview([FromBody] PerformanceReviewCreateRequest body, CancellationToken ct)
    {
        if (body.EmployeeId <= 0)
            return BadRequest(new { error = "employeeId required" });

        var reviewType = string.IsNullOrWhiteSpace(body.ReviewType) ? "annual" : body.ReviewType.Trim();
        if (!ReviewTypes.Contains(reviewType))
            return BadRequest(new { error = "invalid reviewType" });

        var status = string.IsNullOrWhiteSpace(body.Status) ? "draft" : body.Status.Trim();
        if (!ReviewStatuses.Contains(status))
            return BadRequest(new { error = "invalid status" });

        var row = await _hr.CreatePerformanceReviewAsync(
            body.EmployeeId, body.ReviewerName, reviewType, body.Rating,
            body.Summary, status, body.ReviewDate, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("reviews/{id:int}")]
    [Authorize(Roles = "admin,employee")]
    public async Task<IActionResult> UpdateReviewStatus(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });
        if (!ReviewStatuses.Contains(body.Status.Trim()))
            return BadRequest(new { error = "invalid status" });

        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null or <= 0) return BadRequest(new { error = "employee profile not linked" });
            if (!await _hr.PerformanceReviewOwnedByAsync(id, self.Value, ct))
                return Forbid();
            if (!string.Equals(body.Status.Trim(), "acknowledged", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { error = "employees may only acknowledge reviews" });
        }

        var row = await _hr.UpdatePerformanceReviewStatusAsync(id, body.Status.Trim(), ct);
        return row is null ? NotFound() : Ok(row);
    }
}
