using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "TravelExpense")]
[Route("api/travel")]
[Authorize]
public sealed class TravelExpenseController : ControllerBase
{
    private static readonly HashSet<string> TravelStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "pending", "approved", "rejected", "cancelled"
    };

    private static readonly HashSet<string> ExpenseStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "pending", "approved", "rejected", "paid"
    };

    private readonly HrQueryService _hr;
    private readonly RbacService _rbac;
    private readonly IWebHostEnvironment _env;

    public TravelExpenseController(HrQueryService hr, RbacService rbac, IWebHostEnvironment env)
    {
        _hr = hr;
        _rbac = rbac;
        _env = env;
    }

    [HttpGet("requests")]
    public async Task<IActionResult> TravelRequests(CancellationToken ct) =>
        Ok(await _hr.TravelRequestsAsync(ct));

    [HttpPost("requests")]
    [Authorize]
    public async Task<IActionResult> CreateTravel([FromBody] TravelRequestCreateRequest body, CancellationToken ct)
    {
        var employeeId = body.EmployeeId;
        if (User.IsInRole("employee"))
        {
            var self = DigitalDive.Hr.Api.Helpers.CurrentUser.EmployeeId(User);
            if (self is null) return Forbid();
            employeeId = self.Value;
        }
        if (employeeId <= 0)
            return BadRequest(new { error = "employeeId required" });
        if (string.IsNullOrWhiteSpace(body.Destination))
            return BadRequest(new { error = "destination required" });
        if (string.IsNullOrWhiteSpace(body.StartDate) || string.IsNullOrWhiteSpace(body.EndDate))
            return BadRequest(new { error = "startDate and endDate required" });

        var row = await _hr.CreateTravelRequestAsync(
            employeeId, body.Destination.Trim(), body.Purpose,
            body.StartDate, body.EndDate, body.EstimatedCost,
            string.IsNullOrWhiteSpace(body.Currency) ? "AED" : body.Currency, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("requests/{id:int}")]
    public async Task<IActionResult> UpdateTravel(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "travel.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(body.Status) || !TravelStatuses.Contains(body.Status.Trim()))
            return BadRequest(new { error = "invalid status" });
        var row = await _hr.UpdateTravelStatusAsync(id, body.Status.Trim(), ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet("expenses")]
    public async Task<IActionResult> Expenses(CancellationToken ct) =>
        Ok(await _hr.ExpenseClaimsAsync(ct));

    [HttpPost("expenses")]
    public async Task<IActionResult> CreateExpense([FromBody] ExpenseClaimCreateRequest body, CancellationToken ct)
    {
        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null) return Forbid();
            body.EmployeeId = self.Value;
        }
        else if (!await PermissionGate.HasAsync(_rbac, User, ct, "travel.view")) return Forbid();
        if (body.EmployeeId <= 0)
            return BadRequest(new { error = "employeeId required" });
        if (string.IsNullOrWhiteSpace(body.Title))
            return BadRequest(new { error = "title required" });
        if (body.Amount <= 0)
            return BadRequest(new { error = "amount must be > 0" });

        var row = await _hr.CreateExpenseClaimAsync(
            body.EmployeeId, body.Title.Trim(), body.Category, body.Amount,
            body.Currency, body.ExpenseDate, body.Notes, body.ReceiptFileRef, body.ReceiptFileName, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPost("expenses/upload-receipt")]
    [RequestSizeLimit(20_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 20_000_000)]
    public async Task<IActionResult> UploadReceipt(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length <= 0) return BadRequest(new { error = "receipt file required" });
        if (file.Length > 20_000_000) return BadRequest(new { error = "receipt too large (max 20MB)" });
        var ext = Path.GetExtension(file.FileName);
        var allowed = new[] { ".pdf", ".png", ".jpg", ".jpeg", ".webp" };
        if (!allowed.Contains(ext, StringComparer.OrdinalIgnoreCase)) return BadRequest(new { error = "receipt must be PDF, PNG, JPG, JPEG, or WEBP" });
        var webRoot = string.IsNullOrWhiteSpace(_env.WebRootPath) ? Path.Combine(_env.ContentRootPath, "wwwroot") : _env.WebRootPath;
        var dir = Path.Combine(webRoot, "uploads", "expenses");
        Directory.CreateDirectory(dir);
        var safe = Path.GetFileNameWithoutExtension(file.FileName);
        safe = string.Join("_", safe.Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries));
        if (string.IsNullOrWhiteSpace(safe)) safe = "receipt";
        if (safe.Length > 80) safe = safe[..80];
        var stored = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}_{safe}{ext.ToLowerInvariant()}";
        await using (var stream = System.IO.File.Create(Path.Combine(dir, stored))) await file.CopyToAsync(stream, ct);
        return Ok(new { fileRef = $"uploads/expenses/{stored}", fileName = file.FileName });
    }

    [HttpPatch("expenses/{id:int}")]
    public async Task<IActionResult> UpdateExpense(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "travel.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(body.Status) || !ExpenseStatuses.Contains(body.Status.Trim()))
            return BadRequest(new { error = "invalid status" });
        var row = await _hr.UpdateExpenseStatusAsync(id, body.Status.Trim(), ct);
        return row is null ? NotFound() : Ok(row);
    }
}
