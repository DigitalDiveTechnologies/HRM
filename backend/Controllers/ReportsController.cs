using System.Text;
using DigitalDive.Hr.Api.Helpers;
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
    private readonly OpsScaleService _ops;

    public ReportsController(HrQueryService hr, OpsScaleService ops)
    {
        _hr = hr;
        _ops = ops;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) => Ok(await _hr.ReportsAsync(ct));

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(CancellationToken ct) =>
        Ok(await _hr.ReportsDashboardAsync(ct));

    [HttpGet("pack")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Pack(CancellationToken ct) => Ok(await _ops.AnalyticsPackAsync(ct));

    [HttpGet("export/{reportKey}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Export(string reportKey, CancellationToken ct)
    {
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
