using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Benefits")]
[Route("api/benefits")]
[Authorize(Roles = "admin,manager,employee,super_admin")]
public sealed class BenefitsController : ControllerBase
{
    private readonly HrQueryService _hr;
    private readonly RbacService _rbac;

    public BenefitsController(HrQueryService hr, RbacService rbac)
    {
        _hr = hr;
        _rbac = rbac;
    }

    [HttpGet("plans")]
    public async Task<IActionResult> Plans([FromQuery] bool activeOnly = false, CancellationToken ct = default)
    {
        var plans = await _hr.BenefitPlansAsync(activeOnly, ct);
        return Ok(plans);
    }

    [HttpGet("plans/{id:int}")]
    public async Task<IActionResult> PlanById(int id, CancellationToken ct)
    {
        var plan = await _hr.BenefitPlanByIdAsync(id, ct);
        return plan is null ? NotFound(new { error = "Benefit plan not found." }) : Ok(plan);
    }

    [HttpPost("plans")]
    public async Task<IActionResult> CreatePlan([FromBody] BenefitPlanCreateRequest body, CancellationToken ct)
    {
        var role = CurrentUser.Role(User);
        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        var (row, error) = await _hr.CreateBenefitPlanAsync(
            body.Name,
            body.BenefitType,
            body.ProviderName,
            body.PolicyNumber,
            body.CoverageSummary,
            body.AnnualPremiumEmployer,
            body.AnnualPremiumEmployee,
            body.IsActive,
            ct);

        if (error is not null)
            return BadRequest(new { error });

        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPost("assign")]
    public async Task<IActionResult> AssignBenefit([FromBody] BenefitAssignRequest body, CancellationToken ct)
    {
        var role = CurrentUser.Role(User);
        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        var (row, error) = await _hr.AssignEmployeeBenefitAsync(
            body.EmployeeId,
            body.BenefitPlanId,
            body.MemberId,
            body.CoverageTier,
            body.DependentsCount,
            body.StartDate,
            body.EndDate,
            body.Status,
            ct);

        if (error is not null)
            return BadRequest(new { error });

        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpGet("assignments")]
    public async Task<IActionResult> Assignments(
        [FromQuery] int? employeeId,
        [FromQuery] int? planId,
        [FromQuery] string? status,
        CancellationToken ct)
    {
        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null) return Forbid();
            employeeId = self.Value;
        }

        var list = await _hr.EmployeeBenefitsListAsync(employeeId, planId, status, ct);
        return Ok(list);
    }

    [HttpGet("my-benefits")]
    public async Task<IActionResult> MyBenefits(CancellationToken ct)
    {
        var self = CurrentUser.EmployeeId(User);
        if (self is null or <= 0)
            return Ok(Array.Empty<object>());

        var benefits = await _hr.MyBenefitsAsync(self.Value, ct);
        return Ok(benefits);
    }
}
