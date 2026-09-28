using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using DigitalDive.Hr.Api.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Onboarding")]
[Route("api/onboarding")]
[Authorize]
public sealed class OnboardingController : ControllerBase
{
    private readonly HrQueryService _hr;
    private readonly RbacService _rbac;

    public OnboardingController(HrQueryService hr, RbacService rbac)
    {
        _hr = hr;
        _rbac = rbac;
    }

    public sealed class OnboardingCreateRequest
    {
        public int EmployeeId { get; set; }
        public string Title { get; set; } = "";
        public string? Category { get; set; }
        public string? TagNo { get; set; }
        public string? DueDate { get; set; }
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "onboarding.view")) return Forbid();
        return Ok(await _hr.OnboardingAsync(ct));
    }

    /// <summary>Employee portal: return only the onboarding tasks assigned to the signed-in employee.</summary>
    [HttpGet("my")]
    [Authorize(Roles = "employee")]
    public async Task<IActionResult> MyTasks(CancellationToken ct)
    {
        var employeeId = CurrentUser.EmployeeId(User);
        if (employeeId is null or <= 0) return Forbid();
        return Ok(await _hr.OnboardingForEmployeeAsync(employeeId.Value, ct));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] OnboardingCreateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "onboarding.view")) return Forbid();
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

        if (CurrentUser.IsEmployee(User))
        {
            var employeeId = CurrentUser.EmployeeId(User);
            if (employeeId is null or <= 0) return Forbid();
            var empRow = await _hr.UpdateOnboardingForEmployeeAsync(id, employeeId.Value, body.Status.Trim().ToLowerInvariant(), ct);
            return empRow is null ? NotFound(new { error = "Task not found or access denied" }) : Ok(empRow);
        }

        if (!await PermissionGate.HasAsync(_rbac, User, ct, "onboarding.view")) return Forbid();
        var row = await _hr.UpdateOnboardingAsync(id, body.Status.Trim().ToLowerInvariant(), ct);
        return row is null ? NotFound() : Ok(row);
    }

    public sealed class CategoryCreateRequest
    {
        public string Name { get; set; } = "";
    }

    [HttpGet("categories")]
    public async Task<IActionResult> ListCategories(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "onboarding.view")) return Forbid();
        return Ok(await _hr.OnboardingCategoriesAsync(ct));
    }

    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory([FromBody] CategoryCreateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "onboarding.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(body?.Name)) return BadRequest(new { error = "Category name is required." });
        var (row, error) = await _hr.CreateOnboardingCategoryAsync(body.Name, ct);
        if (error is not null) return BadRequest(new { error });
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpDelete("categories/{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "onboarding.view")) return Forbid();
        var deleted = await _hr.DeleteOnboardingCategoryAsync(id, ct);
        return deleted ? Ok(new { success = true }) : NotFound(new { error = "Category not found." });
    }
}
