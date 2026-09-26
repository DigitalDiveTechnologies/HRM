using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Org")]
[Route("api/org-brand")]
[Authorize]
public sealed class OrgBrandController : ControllerBase
{
    private readonly OpsScaleService _ops;
    private readonly RbacService _rbac;

    public OrgBrandController(OpsScaleService ops, RbacService rbac)
    {
        _ops = ops;
        _rbac = rbac;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var brand = await _ops.GetOrgBrandAsync(ct);
        return Ok(brand);
    }

    [HttpPut]
    [Authorize(Roles = "admin,super_admin")]
    public async Task<IActionResult> Put([FromBody] OrgBrandUpdateRequest body, CancellationToken ct)
    {
        var role = CurrentUser.Role(User);
        var perms = await _rbac.GetPermissionCodesForRoleAsync(role, ct);
        var allowed = string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase)
            || perms.Any(p => string.Equals(p, "company.brand.edit", StringComparison.OrdinalIgnoreCase))
            || (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) && perms.Count == 0);
        if (!allowed)
            return Forbid();

        var name = (body.DisplayName ?? string.Empty).Trim();
        if (name.Length < 1)
            return BadRequest(new { error = "Brand name is required." });

        var actor = CurrentUser.Email(User);
        await _ops.UpsertConfigAsync("org.display_name", name, "All Companies sidebar brand name", actor, ct);
        if (body.LogoUrl is not null)
        {
            await _ops.UpsertConfigAsync(
                "org.logo_url",
                body.LogoUrl,
                "All Companies sidebar logo (data URL or path)",
                actor,
                ct);
        }

        return Ok(await _ops.GetOrgBrandAsync(ct));
    }
}

public sealed class OrgBrandUpdateRequest
{
    public string? DisplayName { get; set; }
    public string? LogoUrl { get; set; }
}
