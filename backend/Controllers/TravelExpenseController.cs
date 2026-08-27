using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "TravelExpense")]
[Route("api/travel")]
[Authorize(Roles = "admin,manager")]
public sealed class TravelExpenseController : ControllerBase
{
    private static readonly HashSet<string> TravelStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "pending", "approved", "rejected", "cancelled"
    };

    private static readonly HashSet<string> ExpenseStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "pending", "approved", "rejected", "paid"
    };

    private readonly HrQueryService _hr;

    public TravelExpenseController(HrQueryService hr) => _hr = hr;

    [HttpGet("requests")]
    public async Task<IActionResult> TravelRequests(CancellationToken ct) =>
        Ok(await _hr.TravelRequestsAsync(ct));

    [HttpPost("requests")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateTravel([FromBody] TravelRequestCreateRequest body, CancellationToken ct)
    {
        if (body.EmployeeId <= 0)
            return BadRequest(new { error = "employeeId required" });
        if (string.IsNullOrWhiteSpace(body.Destination))
            return BadRequest(new { error = "destination required" });
        if (string.IsNullOrWhiteSpace(body.StartDate) || string.IsNullOrWhiteSpace(body.EndDate))
            return BadRequest(new { error = "startDate and endDate required" });

        var row = await _hr.CreateTravelRequestAsync(
            body.EmployeeId, body.Destination.Trim(), body.Purpose,
            body.StartDate, body.EndDate, body.EstimatedCost, body.Currency, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("requests/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdateTravel(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status) || !TravelStatuses.Contains(body.Status.Trim()))
            return BadRequest(new { error = "invalid status" });
        var row = await _hr.UpdateTravelStatusAsync(id, body.Status.Trim(), ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet("expenses")]
    public async Task<IActionResult> Expenses(CancellationToken ct) =>
        Ok(await _hr.ExpenseClaimsAsync(ct));

    [HttpPost("expenses")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateExpense([FromBody] ExpenseClaimCreateRequest body, CancellationToken ct)
    {
        if (body.EmployeeId <= 0)
            return BadRequest(new { error = "employeeId required" });
        if (string.IsNullOrWhiteSpace(body.Title))
            return BadRequest(new { error = "title required" });
        if (body.Amount <= 0)
            return BadRequest(new { error = "amount must be > 0" });

        var row = await _hr.CreateExpenseClaimAsync(
            body.EmployeeId, body.Title.Trim(), body.Category, body.Amount,
            body.Currency, body.ExpenseDate, body.Notes, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("expenses/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdateExpense(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status) || !ExpenseStatuses.Contains(body.Status.Trim()))
            return BadRequest(new { error = "invalid status" });
        var row = await _hr.UpdateExpenseStatusAsync(id, body.Status.Trim(), ct);
        return row is null ? NotFound() : Ok(row);
    }
}
