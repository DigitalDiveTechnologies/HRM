using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Notifications")]
[Route("api/notifications")]
[Authorize(Roles = "admin,manager,employee")]
public sealed class NotificationsController : ControllerBase
{
    private readonly HrQueryService _hr;

    public NotificationsController(HrQueryService hr) => _hr = hr;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        int? only = CurrentUser.IsEmployee(User) ? CurrentUser.EmployeeId(User) : null;
        return Ok(await _hr.NotificationsAsync(only, ct));
    }

    [HttpPatch("{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id, CancellationToken ct)
    {
        var row = await _hr.MarkNotificationReadAsync(id, ct);
        return row is null ? NotFound() : Ok(row);
    }
}
