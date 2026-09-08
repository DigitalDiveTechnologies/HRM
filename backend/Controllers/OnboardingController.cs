using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Onboarding")]
[Route("api/onboarding")]
[Authorize(Roles = "admin")]
public sealed class OnboardingController : ControllerBase
{
    private readonly HrQueryService _hr;

    public OnboardingController(HrQueryService hr) => _hr = hr;

    public sealed class OnboardingCreateRequest
    {
        public int EmployeeId { get; set; }
        public string Title { get; set; } = "";
        public string? Category { get; set; }
        public string? TagNo { get; set; }
        public string? DueDate { get; set; }
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await _hr.OnboardingAsync(ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] OnboardingCreateRequest body, CancellationToken ct)
    {
        var (row, error) = await _hr.CreateOnboardingAsync(
            body.EmployeeId, body.Title, body.Category, body.TagNo, body.DueDate, ct);
        if (error is not null) return BadRequest(new { error });
        await _hr.WriteAuditAsync(User.FindFirst("email")?.Value, User.FindFirst("role")?.Value,
            "create", "onboarding_task", Convert.ToInt32(row!["id"]), body.Title, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status)) return BadRequest(new { error = "status required" });
        var row = await _hr.UpdateOnboardingAsync(id, body.Status, ct);
        return row is null ? NotFound() : Ok(row);
    }
}
