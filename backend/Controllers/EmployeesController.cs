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
    private readonly EmployeeBulkService _bulk;

    public EmployeesController(HrQueryService hr, EmployeeBulkService bulk)
    {
        _hr = hr;
        _bulk = bulk;
    }

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

    [HttpGet("bulk/template")]
    [Authorize(Roles = "admin")]
    public IActionResult BulkTemplate()
    {
        var bytes = _bulk.BuildTemplate();
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "employee-bulk-template.xlsx");
    }

    [HttpPost("bulk")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> BulkUpload(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { error = "Upload an Excel file (.xlsx)." });
        }

        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { error = "Only .xlsx files are supported." });
        }

        await using var stream = file.OpenReadStream();
        var result = await _bulk.ImportAsync(stream, ct);
        return Ok(result);
    }

    /// <summary>Create employee record + mobile app login (employee role).</summary>
    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeRequest body, CancellationToken ct)
    {
        var jobTitle = body.JobTitle?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(jobTitle) && !body.DesignationId.HasValue)
        {
            return BadRequest(new { error = "Designation or job title is required." });
        }

        var fullName = !string.IsNullOrWhiteSpace(body.FullName)
            ? body.FullName.Trim()
            : string.Join(' ', new[] { body.FirstName, body.MiddleName, body.LastName }
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p!.Trim()));

        var (employee, error) = await _hr.CreateEmployeeWithLoginAsync(
            fullName,
            body.Email,
            body.Password,
            string.IsNullOrWhiteSpace(jobTitle) ? "Employee" : jobTitle,
            body.Phone,
            body.DepartmentId,
            body.DivisionId,
            body.DesignationId,
            body.EmploymentTypeId,
            body.ManagerId,
            body.JoinDate,
            body.Status ?? "active",
            body.MasterData,
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

    [HttpPatch("{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateEmployeeRequest body, CancellationToken ct)
    {
        var (employee, error) = await _hr.UpdateEmployeeAsync(id, body, ct);

        if (error is not null)
        {
            return error.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error })
                : BadRequest(new { error });
        }

        return Ok(new { employee, message = "Employee updated." });
    }

    [HttpPost("{id:int}/reset-password")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetEmployeePasswordRequest body, CancellationToken ct)
    {
        var (ok, error) = await _hr.ResetEmployeePasswordAsync(id, body.Password, ct);
        if (!ok) return BadRequest(new { error });
        return Ok(new { message = "App login password updated." });
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
