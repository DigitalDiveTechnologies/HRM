using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
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
        var role = CurrentUser.Role(User).ToLowerInvariant();
        var rows = await _hr.EmployeesAsync(ct);
        if (role == "employee")
        {
            var id = CurrentUser.EmployeeId(User);
            if (!id.HasValue) return Ok(Array.Empty<object>());
            return Ok(rows.Where(r => Convert.ToInt32(r["id"]) == id.Value).ToList());
        }

        return Ok(rows);
    }

    [HttpGet("departments")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Departments(CancellationToken ct) =>
        Ok(await _hr.DepartmentsAsync(ct));

    /// <summary>Create employee record + mobile app login (employee role).</summary>
    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeRequest body, CancellationToken ct)
    {
        var (employee, error) = await _hr.CreateEmployeeWithLoginAsync(
            body.FullName,
            body.Email,
            body.Password,
            body.JobTitle,
            body.Phone,
            body.DepartmentId,
            body.ManagerId,
            body.JoinDate,
            body.Status ?? "active",
            ct);

        if (error is not null)
        {
            return BadRequest(new { error });
        }

        return Ok(new
        {
            employee,
            login = new
            {
                email = body.Email.Trim().ToLowerInvariant(),
                role = "employee",
            },
            message = "Employee created. They can sign in on the mobile app with this email and password.",
        });
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
