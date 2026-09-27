using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Dashboard")]
[Route("api/dashboard")]
[Authorize]
public sealed class DashboardController : ControllerBase
{
    private readonly HrQueryService _hr;
    private readonly RbacService _rbac;

    public DashboardController(HrQueryService hr, RbacService rbac)
    {
        _hr = hr;
        _rbac = rbac;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "dashboard.view"))
            return Forbid();
        return Ok(await _hr.DashboardAsync(ct));
    }
}
