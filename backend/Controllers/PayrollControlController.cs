using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "PayrollControl")]
[Route("api/payroll/runs")]
[Authorize(Roles = "admin")]
public sealed class PayrollControlController : ControllerBase
{
    private readonly PayrollControlService _svc;

    public PayrollControlController(PayrollControlService svc) => _svc = svc;

    public sealed class CalculateRequest
    {
        public string PeriodLabel { get; set; } = "";
        public decimal OtRatePerHour { get; set; } = 50m;
        public int? LegalEntityId { get; set; }
    }

    public sealed class TransitionRequest
    {
        public string Action { get; set; } = "";
        public bool ForceSelfApprove { get; set; }
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await _svc.ListRunsAsync(ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var run = await _svc.GetRunAsync(id, ct);
        if (run is null) return NotFound();
        var lines = await _svc.GetLinesAsync(id, ct);
        return Ok(new { run, lines });
    }

    [HttpPost("calculate")]
    public async Task<IActionResult> Calculate([FromBody] CalculateRequest body, CancellationToken ct)
    {
        var email = User.FindFirst("email")?.Value;
        var (result, error) = await _svc.CalculateAsync(body.PeriodLabel, body.OtRatePerHour, body.LegalEntityId, email, ct);
        if (error is not null) return BadRequest(new { error, isPreview = true });
        return Ok(result);
    }

    [HttpPost("{id:int}/transition")]
    public async Task<IActionResult> Transition(int id, [FromBody] TransitionRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Action))
            return BadRequest(new { error = "action required" });
        var email = User.FindFirst("email")?.Value;
        var role = User.FindFirst("role")?.Value;
        if (string.Equals(body.Action, "reverse", StringComparison.OrdinalIgnoreCase))
        {
            var (rev, err) = await _svc.ReverseAsync(id, email, role, ct);
            if (err is not null) return BadRequest(new { error = err });
            return Ok(rev);
        }

        var (row, error) = await _svc.TransitionAsync(id, body.Action, email, role, body.ForceSelfApprove, ct);
        if (error is not null) return BadRequest(new { error });
        return Ok(row);
    }

    [HttpGet("{id:int}/sif")]
    public async Task<IActionResult> Sif(int id, CancellationToken ct)
    {
        var (content, fileName, error, isPreview) = await _svc.BuildSifFromRunAsync(id, ct);
        if (error is not null) return BadRequest(new { error, isPreview = true });
        Response.Headers["X-GOCs-Payroll-Preview"] = isPreview ? "true" : "false";
        return File(System.Text.Encoding.UTF8.GetBytes(content), "text/csv", fileName);
    }

    [HttpGet("~/api/payroll/emiratisation")]
    public async Task<IActionResult> Emiratisation(CancellationToken ct) =>
        Ok(await _svc.EmiratisationGpssaReportAsync(ct));
}
