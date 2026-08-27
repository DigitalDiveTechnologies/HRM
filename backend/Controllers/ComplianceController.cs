using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Compliance")]
[Route("api/compliance")]
[Authorize(Roles = "admin,manager")]
public sealed class ComplianceController : ControllerBase
{
    private static readonly HashSet<string> Categories = new(StringComparer.OrdinalIgnoreCase)
    {
        "labor_law", "visa", "document", "audit", "other"
    };

    private static readonly HashSet<string> Statuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "open", "due_soon", "overdue", "compliant", "closed"
    };

    private readonly HrQueryService _hr;

    public ComplianceController(HrQueryService hr) => _hr = hr;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) =>
        Ok(await _hr.ComplianceItemsAsync(ct));

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create([FromBody] ComplianceItemCreateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Title))
            return BadRequest(new { error = "title required" });

        var category = string.IsNullOrWhiteSpace(body.Category) ? "document" : body.Category.Trim();
        if (!Categories.Contains(category))
            return BadRequest(new { error = "invalid category" });

        var status = string.IsNullOrWhiteSpace(body.Status) ? "open" : body.Status.Trim();
        if (!Statuses.Contains(status))
            return BadRequest(new { error = "invalid status" });

        var row = await _hr.CreateComplianceItemAsync(
            body.EmployeeId > 0 ? body.EmployeeId : null,
            body.Title.Trim(),
            category,
            body.DueDate,
            status,
            body.Notes,
            ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });
        if (!Statuses.Contains(body.Status.Trim()))
            return BadRequest(new { error = "invalid status" });

        var row = await _hr.UpdateComplianceStatusAsync(id, body.Status.Trim(), ct);
        return row is null ? NotFound() : Ok(row);
    }
}
