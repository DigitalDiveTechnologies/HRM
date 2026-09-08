using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Payroll")]
[Route("api/payroll")]
[Authorize(Roles = "admin")]
public sealed class PayrollController : ControllerBase
{
    private readonly HrQueryService _hr;
    private readonly PayrollControlService _control;

    public PayrollController(HrQueryService hr, PayrollControlService control)
    {
        _hr = hr;
        _control = control;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await _hr.PayrollAsync(ct));

    [HttpPost("run")]
    public async Task<IActionResult> Run([FromBody] PayrollRunRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.PeriodLabel))
            return BadRequest(new { error = "periodLabel required (e.g. 2026-08)" });
        // Phase 2: generate payslips + payroll_runs control record
        var email = User.FindFirst("email")?.Value;
        var (result, error) = await _control.CalculateAsync(
            body.PeriodLabel.Trim(), body.OtRatePerHour <= 0 ? 50m : body.OtRatePerHour, null, email, ct);
        if (error is not null) return BadRequest(new { error, isPreview = true });
        return Ok(result);
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] string period, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(period))
            return BadRequest(new { error = "period required (YYYY-MM)" });
        return Ok(await _hr.PayrollSummaryAsync(period.Trim(), ct));
    }

    [HttpGet("wps")]
    public async Task<IActionResult> Wps([FromQuery] string? period, CancellationToken ct)
    {
        var (fileName, csv) = await _hr.BuildWpsCsvAsync(period, ct);
        return File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv", fileName);
    }

    [HttpGet("bank-transfer")]
    public async Task<IActionResult> BankTransfer([FromQuery] string? period, CancellationToken ct)
    {
        var (fileName, csv) = await _hr.BuildBankTransferCsvAsync(period, ct);
        return File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv", fileName);
    }
}
