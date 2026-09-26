using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Divisions")]
[Route("api/divisions")]
[Authorize]
public sealed class DivisionsController : ControllerBase
{
    private readonly HrQueryService _hr;
    private readonly RbacService _rbac;

    public DivisionsController(HrQueryService hr, RbacService rbac)
    {
        _hr = hr;
        _rbac = rbac;
    }

    /// <summary>
    /// List companies in the dropdown / dashboard.
    /// Independent of company.brand.edit (that only edits GOCs All-Companies name+logo).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool activeOnly = false, CancellationToken ct = default) =>
        Ok(await _hr.DivisionsAsync(activeOnly, ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var row = await _hr.DivisionByIdAsync(id, ct);
        return row is null ? NotFound(new { error = "Division not found." }) : Ok(row);
    }

    /// <summary>Create a company — requires company.create (not brand.edit).</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDivisionRequest body, CancellationToken ct)
    {
        if (!await CanManageCompaniesAsync(ct))
            return Forbid();

        var (row, error) = await _hr.CreateDivisionAsync(body.Code, body.Name, body.PayrollType ?? "wps", body.LogoUrl, ct);
        if (error is not null) return BadRequest(new { error });
        return StatusCode(StatusCodes.Status201Created, row);
    }

    /// <summary>Update / soft-delete a company — company.create (or org/structure). Not brand.edit.</summary>
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateDivisionRequest body, CancellationToken ct)
    {
        if (!await CanManageCompaniesAsync(ct))
            return Forbid();

        var (row, error) = await _hr.UpdateDivisionAsync(id, body.Name, body.PayrollType, body.Status, body.LogoUrl, ct);
        if (error is not null)
        {
            return error.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error })
                : BadRequest(new { error });
        }

        return Ok(row);
    }

    /// <summary>
    /// Individual company CRUD. company.brand.edit is ONLY for GOCs All-Companies brand (org-brand API).
    /// </summary>
    private async Task<bool> CanManageCompaniesAsync(CancellationToken ct)
    {
        var role = CurrentUser.Role(User);
        if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase))
            return true;

        var perms = await _rbac.GetPermissionCodesForRoleAsync(role, ct);
        return perms.Any(p =>
            string.Equals(p, "company.create", StringComparison.OrdinalIgnoreCase)
            || string.Equals(p, "company.organisation", StringComparison.OrdinalIgnoreCase)
            || string.Equals(p, "company.structure", StringComparison.OrdinalIgnoreCase));
    }
}
