using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "ExitSettlement")]
[Route("api/exit")]
[Authorize(Roles = "admin")]
public sealed class ExitSettlementController : ControllerBase
{
    private readonly ExitSettlementService _svc;

    public ExitSettlementController(ExitSettlementService svc) => _svc = svc;

    public sealed class SettlementRequest
    {
        public decimal UnusedLeaveDays { get; set; }
        public decimal NoticePayDays { get; set; }
        public decimal OtherEarnings { get; set; }
        public decimal OtherDeductions { get; set; }
    }

    [HttpPost("{id:int}/settlement")]
    public async Task<IActionResult> Calculate(int id, [FromBody] SettlementRequest? body, CancellationToken ct)
    {
        body ??= new SettlementRequest();
        var email = User.FindFirst("email")?.Value;
        var (result, error) = await _svc.CalculateForExitCaseAsync(
            id, email, body.UnusedLeaveDays, body.NoticePayDays, body.OtherEarnings, body.OtherDeductions, ct);
        if (error is not null) return BadRequest(new { error, isPreview = true });
        return Ok(result);
    }

    [HttpGet("{id:int}/settlement")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var row = await _svc.GetSettlementAsync(id, ct);
        return row is null ? NotFound(new { error = "No settlement yet", isPreview = true }) : Ok(row);
    }
}
