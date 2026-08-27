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

    public PayrollController(HrQueryService hr) => _hr = hr;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await _hr.PayrollAsync(ct));
}
