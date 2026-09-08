using DigitalDive.Hr.Api.Data;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

/// <summary>Phase 2 preview endpoints — outputs labelled test/preview until sir config is plugged in.</summary>
[ApiController]
[ApiExplorerSettings(GroupName = "PayrollPreview")]
[Route("api/payroll")]
[Authorize(Roles = "admin")]
public sealed class PayrollPreviewController : ControllerBase
{
    private readonly EosbCalculatorService _eosb;
    private readonly WpsSifPreviewService _sif;
    private readonly HrQueryService _hr;

    public PayrollPreviewController(EosbCalculatorService eosb, WpsSifPreviewService sif, HrQueryService hr)
    {
        _eosb = eosb;
        _sif = sif;
        _hr = hr;
    }

    public sealed class EosbPreviewRequest
    {
        public decimal BasicSalary { get; set; }
        public double ServiceYears { get; set; }
        public double UnpaidLeaveDays { get; set; }
        public string? JurisdictionProfile { get; set; }
    }

    [HttpPost("eosb/preview")]
    public async Task<IActionResult> EosbPreview([FromBody] EosbPreviewRequest body, CancellationToken ct)
    {
        var result = await _eosb.CalculatePreviewAsync(
            body.BasicSalary, body.ServiceYears, body.UnpaidLeaveDays, body.JurisdictionProfile, ct);
        return Ok(result);
    }

    [HttpGet("sif/preview")]
    public async Task<IActionResult> SifPreview(
        [FromQuery] int year,
        [FromQuery] int month,
        [FromQuery] int? legalEntityId,
        CancellationToken ct)
    {
        if (year < 2000 || month is < 1 or > 12)
            return BadRequest(new { error = "year and month required", isPreview = true });

        var (content, fileName, isPreview, warning) = await _sif.BuildPreviewSifAsync(legalEntityId, year, month, ct);
        await _hr.WriteAuditAsync(
            User.FindFirst("email")?.Value,
            User.FindFirst("role")?.Value,
            "export",
            "wps_sif_preview",
            null,
            $"{fileName}; {warning}",
            ct);

        Response.Headers["X-GOCs-Payroll-Preview"] = "true";
        if (!string.IsNullOrWhiteSpace(warning))
            Response.Headers["X-GOCs-Payroll-Warning"] = warning;

        return File(System.Text.Encoding.UTF8.GetBytes(content), "text/csv", fileName);
    }
}
