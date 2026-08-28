using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Reports")]
[Route("api/reports")]
[Authorize(Roles = "admin,manager")]
public sealed class ReportsController : ControllerBase
{
    private readonly HrQueryService _hr;

    public ReportsController(HrQueryService hr) => _hr = hr;

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) => Ok(await _hr.ReportsAsync(ct));

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(CancellationToken ct) =>
        Ok(await _hr.ReportsDashboardAsync(ct));
}
