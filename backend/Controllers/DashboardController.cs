using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Dashboard")]
[Route("api/dashboard")]
[Authorize(Roles = "admin,manager")]
public sealed class DashboardController : ControllerBase
{
    private readonly HrQueryService _hr;

    public DashboardController(HrQueryService hr) => _hr = hr;

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) => Ok(await _hr.DashboardAsync(ct));
}
