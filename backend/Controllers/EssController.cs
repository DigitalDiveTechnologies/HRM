using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Ess")]
[Route("api/ess")]
[Authorize(Roles = "admin,manager,employee")]
public sealed class EssController : ControllerBase
{
    private readonly HrQueryService _hr;

    public EssController(HrQueryService hr) => _hr = hr;

    [HttpGet("{employeeId:int}")]
    public async Task<IActionResult> Get(int employeeId, CancellationToken ct)
    {
        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null || self.Value != employeeId) return Forbid();
        }

        return Ok(await _hr.EssAsync(employeeId, ct));
    }

    [HttpPatch("{employeeId:int}/profile")]
    public async Task<IActionResult> UpdateProfile(int employeeId, [FromBody] EssProfileUpdateRequest body, CancellationToken ct)
    {
        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null || self.Value != employeeId) return Forbid();
        }

        var row = await _hr.UpdateEssPhoneAsync(employeeId, body.Phone, ct);
        return row is null ? NotFound() : Ok(row);
    }
}
