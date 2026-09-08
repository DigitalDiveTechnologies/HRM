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
    private readonly OpsScaleService _ops;

    public NotificationsController(HrQueryService hr, OpsScaleService ops)
    {
        _hr = hr;
        _ops = ops;
    }

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

    [HttpPatch("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        int? only = CurrentUser.IsEmployee(User) ? CurrentUser.EmployeeId(User) : null;
        var updated = await _hr.MarkAllNotificationsReadAsync(only, ct);
        return Ok(new { updated, message = $"Marked {updated} notification(s) as read." });
    }

    [HttpPost("generate")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Generate(CancellationToken ct)
    {
        var jobId = await _ops.BeginJobAsync("notifications.generate", CurrentUser.Email(User), ct);
        try
        {
            var result = await _hr.GenerateNotificationsAsync(ct);
            var inserted = result.GetType().GetProperty("inserted")?.GetValue(result);
            await _ops.FinishJobAsync(jobId, true, $"inserted={inserted}", ct);
            return Ok(new { jobId, result });
        }
        catch (Exception ex)
        {
            await _ops.FinishJobAsync(jobId, false, ex.Message, ct);
            throw;
        }
    }
}
