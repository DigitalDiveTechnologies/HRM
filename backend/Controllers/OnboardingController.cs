using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Onboarding")]
[Route("api/onboarding")]
[Authorize(Roles = "admin")]
public sealed class OnboardingController : ControllerBase
{
    private readonly HrQueryService _hr;

    public OnboardingController(HrQueryService hr) => _hr = hr;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await _hr.OnboardingAsync(ct));

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status)) return BadRequest(new { error = "status required" });
        var row = await _hr.UpdateOnboardingAsync(id, body.Status, ct);
        return row is null ? NotFound() : Ok(row);
    }
}
