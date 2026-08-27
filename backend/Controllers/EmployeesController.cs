using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Employees")]
[Route("api/employees")]
[Authorize]
public sealed class EmployeesController : ControllerBase
{
    private readonly HrQueryService _hr;

    public EmployeesController(HrQueryService hr) => _hr = hr;

    /// <summary>Admin/manager: full ops list. Employee: self only (for forms).</summary>
    [HttpGet]
    [Authorize(Roles = "admin,manager,employee")]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value?.ToLowerInvariant();
        var rows = await _hr.EmployeesAsync(ct);
        if (role == "employee")
        {
            var eid = User.FindFirst("employee_id")?.Value;
            if (!int.TryParse(eid, out var id)) return Ok(Array.Empty<object>());
            return Ok(rows.Where(r => Convert.ToInt32(r["id"]) == id).ToList());
        }

        return Ok(rows);
    }

    /// <summary>Safe directory for mobile/ESS — no salary fields.</summary>
    [HttpGet("directory")]
    [Authorize(Roles = "admin,manager,employee")]
    public async Task<IActionResult> Directory(CancellationToken ct)
    {
        var rows = await _hr.EmployeesAsync(ct);
        var safe = rows.Select(r => new
        {
            id = r.GetValueOrDefault("id"),
            empCode = r.GetValueOrDefault("empCode"),
            fullName = r.GetValueOrDefault("fullName"),
            email = r.GetValueOrDefault("email"),
            phone = r.GetValueOrDefault("phone"),
            jobTitle = r.GetValueOrDefault("jobTitle"),
            departmentName = r.GetValueOrDefault("departmentName"),
            status = r.GetValueOrDefault("status"),
        });
        return Ok(safe);
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = "admin,manager")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var row = await _hr.EmployeeByIdAsync(id, ct);
        return row is null ? NotFound(new { error = "Not found" }) : Ok(row);
    }
}
