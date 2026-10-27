using DigitalDive.Hr.Api.Data;
using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Benefits")]
[Route("api/benefits")]
[Authorize(Roles = "admin,manager,employee,super_admin")]
public sealed class BenefitsController : ControllerBase
{
    private readonly Db _db;
    private readonly HrQueryService _hr;
    private readonly RbacService _rbac;

    public BenefitsController(Db db, HrQueryService hr, RbacService rbac)
    {
        _db = db;
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

    [HttpPut("plans/{id:int}")]
    public async Task<IActionResult> UpdatePlan(int id, [FromBody] BenefitPlanCreateRequest body, CancellationToken ct)
    {
        var role = CurrentUser.Role(User);
        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(body.Name))
            return BadRequest(new { error = "Plan name is required." });

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        const string sql = @"
            UPDATE benefit_plans
            SET name = @name,
                benefit_type = @benefit_type,
                provider_name = @provider_name,
                policy_number = @policy_number,
                coverage_summary = @coverage_summary,
                annual_premium_employer = @annual_premium_employer,
                annual_premium_employee = @annual_premium_employee,
                is_active = @is_active,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = @id
            RETURNING id, name, benefit_type, provider_name, policy_number, coverage_summary,
                      annual_premium_employer, annual_premium_employee, is_active, created_at, updated_at;";

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("name", body.Name.Trim());
        cmd.Parameters.AddWithValue("benefit_type", string.IsNullOrWhiteSpace(body.BenefitType) ? "medical_insurance" : body.BenefitType.Trim());
        cmd.Parameters.AddWithValue("provider_name", body.ProviderName?.Trim() ?? "");
        cmd.Parameters.AddWithValue("policy_number", body.PolicyNumber?.Trim() ?? "");
        cmd.Parameters.AddWithValue("coverage_summary", body.CoverageSummary?.Trim() ?? "");
        cmd.Parameters.AddWithValue("annual_premium_employer", body.AnnualPremiumEmployer);
        cmd.Parameters.AddWithValue("annual_premium_employee", body.AnnualPremiumEmployee);
        cmd.Parameters.AddWithValue("is_active", body.IsActive);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
            return NotFound(new { error = "Benefit plan not found." });

        return Ok(new
        {
            id = reader.GetInt32(0),
            name = reader.GetString(1),
            benefitType = reader.GetString(2),
            providerName = reader.GetString(3),
            policyNumber = reader.GetString(4),
            coverageSummary = reader.IsDBNull(5) ? "" : reader.GetString(5),
            annualPremiumEmployer = reader.GetDecimal(6),
            annualPremiumEmployee = reader.GetDecimal(7),
            isActive = reader.GetBoolean(8),
            createdAt = reader.GetDateTime(9),
            updatedAt = reader.GetDateTime(10)
        });
    }

    [HttpDelete("plans/{id:int}")]
    public async Task<IActionResult> DeletePlan(int id, CancellationToken ct)
    {
        var role = CurrentUser.Role(User);
        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        // Check if any employees currently assigned to this plan
        const string checkSql = "SELECT COUNT(*)::int FROM employee_benefits WHERE benefit_plan_id = @id";
        await using (var checkCmd = new NpgsqlCommand(checkSql, conn))
        {
            checkCmd.Parameters.AddWithValue("id", id);
            var count = (int)(await checkCmd.ExecuteScalarAsync(ct) ?? 0);
            if (count > 0)
            {
                return BadRequest(new { error = $"Cannot delete plan because {count} active employee enrollment(s) are linked to it. Please remove or reassign them first." });
            }
        }

        const string sql = "DELETE FROM benefit_plans WHERE id = @id";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);
        var rows = await cmd.ExecuteNonQueryAsync(ct);

        if (rows == 0) return NotFound(new { error = "Benefit plan not found." });
        return Ok(new { success = true, message = "Benefit plan deleted successfully." });
    }

    [HttpPut("assignments/{id:int}")]
    public async Task<IActionResult> UpdateAssignment(int id, [FromBody] BenefitAssignRequest body, CancellationToken ct)
    {
        var role = CurrentUser.Role(User);
        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        const string sql = @"
            UPDATE employee_benefits
            SET member_id = @member_id,
                coverage_tier = @coverage_tier,
                dependents_count = @dependents_count,
                start_date = @start_date,
                end_date = @end_date,
                status = @status,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = @id
            RETURNING id, employee_id, benefit_plan_id, member_id, coverage_tier, dependents_count, start_date, end_date, status;";

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("member_id", body.MemberId?.Trim() ?? "");
        cmd.Parameters.AddWithValue("coverage_tier", string.IsNullOrWhiteSpace(body.CoverageTier) ? "employee_only" : body.CoverageTier.Trim());
        cmd.Parameters.AddWithValue("dependents_count", body.DependentsCount);
        cmd.Parameters.AddWithValue("start_date", DateTime.TryParse(body.StartDate, out var s) ? s.Date : DateTime.UtcNow.Date);
        cmd.Parameters.AddWithValue("end_date", DateTime.TryParse(body.EndDate, out var e) ? e.Date : (object)DBNull.Value);
        cmd.Parameters.AddWithValue("status", string.IsNullOrWhiteSpace(body.Status) ? "active" : body.Status.Trim());

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
            return NotFound(new { error = "Employee benefit assignment not found." });

        return Ok(new
        {
            id = reader.GetInt32(0),
            employeeId = reader.GetInt32(1),
            benefitPlanId = reader.GetInt32(2),
            memberId = reader.GetString(3),
            coverageTier = reader.GetString(4),
            dependentsCount = reader.GetInt32(5),
            startDate = reader.GetDateTime(6),
            endDate = reader.IsDBNull(7) ? (DateTime?)null : reader.GetDateTime(7),
            status = reader.GetString(8)
        });
    }

    [HttpDelete("assignments/{id:int}")]
    public async Task<IActionResult> DeleteAssignment(int id, CancellationToken ct)
    {
        var role = CurrentUser.Role(User);
        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        const string sql = "DELETE FROM employee_benefits WHERE id = @id";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);
        var rows = await cmd.ExecuteNonQueryAsync(ct);

        if (rows == 0) return NotFound(new { error = "Benefit assignment not found." });
        return Ok(new { success = true, message = "Employee benefit assignment removed successfully." });
    }
}
