using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Departments")]
[Route("api/departments")]
[Authorize]
public sealed class DepartmentsController : ControllerBase
{
    private readonly HrQueryService _hr;
    private readonly RbacService _rbac;

    public DepartmentsController(HrQueryService hr, RbacService rbac)
    {
        _hr = hr;
        _rbac = rbac;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool activeOnly = false, CancellationToken ct = default) =>
        Ok(await _hr.DepartmentsAsync(activeOnly, ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateMasterRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "masters.departments")) return Forbid();
        var (row, error) = await _hr.CreateDepartmentAsync(body.Name, ct);
        if (error is not null) return BadRequest(new { error });
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateMasterRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "masters.departments")) return Forbid();
        var (row, error) = await _hr.UpdateDepartmentAsync(id, body.Name, body.Status, ct);
        if (error is not null)
        {
            return error.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error })
                : BadRequest(new { error });
        }
        return Ok(row);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "masters.departments")) return Forbid();
        var (ok, error) = await _hr.DeleteDepartmentAsync(id, ct);
        if (!ok)
        {
            return error != null && error.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error })
                : BadRequest(new { error });
        }
        return Ok(new { success = true, message = "Department deleted successfully." });
    }
}
