using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Designations")]
[Route("api/designations")]
[Authorize]
public sealed class DesignationsController : ControllerBase
{
    private readonly HrQueryService _hr;
    private readonly RbacService _rbac;

    public DesignationsController(HrQueryService hr, RbacService rbac)
    {
        _hr = hr;
        _rbac = rbac;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool activeOnly = false, CancellationToken ct = default) =>
        Ok(await _hr.DesignationsAsync(activeOnly, ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDesignationRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "masters.designations")) return Forbid();
        var (row, error) = await _hr.CreateDesignationAsync(
            body.Name, body.Code, body.JobFamily, body.Grade, body.SkillLevel, body.DefaultReportingDesignationId, ct);
        if (error is not null) return BadRequest(new { error });
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateMasterRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "masters.designations")) return Forbid();
        var (row, error) = await _hr.UpdateDesignationAsync(
            id, body.Name, body.Status, body.Code, body.JobFamily, body.Grade, body.SkillLevel, body.DefaultReportingDesignationId, ct);
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
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "masters.designations")) return Forbid();
        var (ok, error) = await _hr.DeleteDesignationAsync(id, ct);
        if (!ok)
        {
            return error != null && error.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error })
                : BadRequest(new { error });
        }
        return Ok(new { success = true, message = "Designation deleted successfully." });
    }
}
