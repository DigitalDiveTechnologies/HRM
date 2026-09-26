using System.Text;
using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Reports")]
[Route("api/reports")]
[Authorize]
public sealed class ReportsController : ControllerBase
{
    private readonly HrQueryService _hr;
    private readonly OpsScaleService _ops;
    private readonly RbacService _rbac;

    public ReportsController(HrQueryService hr, OpsScaleService ops, RbacService rbac)
    {
        _hr = hr;
        _ops = ops;
        _rbac = rbac;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "reports.view")) return Forbid();
        return Ok(await _hr.ReportsAsync(ct));
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "reports.view")) return Forbid();
        return Ok(await _hr.ReportsDashboardAsync(ct));
    }

    [HttpGet("pack")]
    public async Task<IActionResult> Pack(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "reports.view")) return Forbid();
        return Ok(await _ops.AnalyticsPackAsync(ct));
    }

    [HttpGet("export/{reportKey}")]
    public async Task<IActionResult> Export(string reportKey, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "reports.view")) return Forbid();
        try
        {
            var (file, csv, _) = await _ops.ExportCsvAsync(reportKey, CurrentUser.Email(User), ct);
            return File(Encoding.UTF8.GetBytes(csv), "text/csv", file);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
