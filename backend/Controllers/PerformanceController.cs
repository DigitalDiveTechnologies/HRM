using System.Text.Json;
using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Performance")]
[Route("api/performance")]
[Authorize]
public sealed class PerformanceController : ControllerBase
{
    private static readonly HashSet<string> GoalStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "active", "completed", "cancelled"
    };

    private static readonly HashSet<string> ReviewTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "annual", "mid_year", "probation", "360"
    };

    private static readonly HashSet<string> ReviewStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "draft", "submitted", "acknowledged"
    };

    private static readonly HashSet<string> NominationStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "pending", "approved", "declined", "submitted"
    };

    private readonly HrQueryService _hr;
    private readonly RbacService _rbac;
    private readonly EmailService _email;
    private readonly IWebHostEnvironment _env;

    public PerformanceController(HrQueryService hr, RbacService rbac, EmailService email, IWebHostEnvironment env)
    {
        _hr = hr;
        _rbac = rbac;
        _email = email;
        _env = env;
    }

    // ==========================================
    // Task 3.1: Goals & Hierarchical Key Results
    // ==========================================

    [HttpGet("goals")]
    public async Task<IActionResult> Goals(CancellationToken ct)
    {
        int? only = CurrentUser.IsEmployee(User) ? CurrentUser.EmployeeId(User) : null;
        if (CurrentUser.IsEmployee(User) && only is null or <= 0)
            return BadRequest(new { error = "employee profile not linked" });
        return Ok(await _hr.PerformanceGoalsAsync(only, ct));
    }

    [HttpPost("goals")]
    public async Task<IActionResult> CreateGoal([FromBody] PerformanceGoalCreateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "performance.view")) return Forbid();
        if (body.EmployeeId <= 0)
            return BadRequest(new { error = "employeeId required" });
        if (string.IsNullOrWhiteSpace(body.Title))
            return BadRequest(new { error = "title required" });

        var status = string.IsNullOrWhiteSpace(body.Status) ? "active" : body.Status.Trim();
        if (!GoalStatuses.Contains(status))
            return BadRequest(new { error = "invalid status" });

        var row = await _hr.CreatePerformanceGoalAsync(
            body.EmployeeId, body.Title.Trim(), body.Kpi, body.TargetValue,
            body.ProgressPct, body.PeriodLabel, status,
            body.ParentGoalId, body.Weightage, body.TargetMetric, body.CurrentMetric, body.DueDate,
            body.FileRef,
            ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("goals/{id:int}")]
    public async Task<IActionResult> UpdateGoal(int id, [FromBody] PerformanceGoalUpdateRequest body, CancellationToken ct)
    {
        if (body.ProgressPct is null && string.IsNullOrWhiteSpace(body.Status) &&
            string.IsNullOrWhiteSpace(body.CurrentMetric) && body.Weightage is null && string.IsNullOrWhiteSpace(body.DueDate) &&
            string.IsNullOrWhiteSpace(body.FileRef))
            return BadRequest(new { error = "no fields to update" });

        if (!string.IsNullOrWhiteSpace(body.Status) && !GoalStatuses.Contains(body.Status.Trim()))
            return BadRequest(new { error = "invalid status" });

        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null or <= 0) return BadRequest(new { error = "employee profile not linked" });
            if (!await _hr.PerformanceGoalOwnedByAsync(id, self.Value, ct))
                return Forbid();
            // Employees may only update progress, current metric & fileRef, not cancel
            var row = await _hr.UpdatePerformanceGoalAsync(id, body.ProgressPct, null, null, null, body.CurrentMetric, null, body.FileRef, ct);
            return row is null ? NotFound() : Ok(row);
        }

        if (!await PermissionGate.HasAsync(_rbac, User, ct, "performance.view")) return Forbid();
        var updated = await _hr.UpdatePerformanceGoalAsync(
            id, body.ProgressPct, body.Status?.Trim(), body.Weightage, body.TargetMetric, body.CurrentMetric, body.DueDate, body.FileRef, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    // ==========================================
    // Reviews
    // ==========================================

    [HttpGet("reviews")]
    public async Task<IActionResult> Reviews([FromQuery] string? employeeType, CancellationToken ct)
    {
        int? only = CurrentUser.IsEmployee(User) ? CurrentUser.EmployeeId(User) : null;
        if (CurrentUser.IsEmployee(User) && only is null or <= 0)
            return BadRequest(new { error = "employee profile not linked" });
        return Ok(await _hr.PerformanceReviewsAsync(only, employeeType, ct));
    }

    [HttpPost("reviews")]
    public async Task<IActionResult> CreateReview([FromBody] PerformanceReviewCreateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "performance.view")) return Forbid();
        if (body.EmployeeId <= 0)
            return BadRequest(new { error = "employeeId required" });

        var reviewType = string.IsNullOrWhiteSpace(body.ReviewType) ? "annual" : body.ReviewType.Trim();
        if (!ReviewTypes.Contains(reviewType))
            return BadRequest(new { error = "invalid reviewType" });

        var status = string.IsNullOrWhiteSpace(body.Status) ? "draft" : body.Status.Trim();
        if (!ReviewStatuses.Contains(status))
            return BadRequest(new { error = "invalid status" });

        string? answersJson = body.AnswersJson is null ? null
            : (body.AnswersJson is string s ? s : JsonSerializer.Serialize(body.AnswersJson));

        var row = await _hr.CreatePerformanceReviewAsync(
            body.EmployeeId, body.ReviewerName, reviewType, body.Rating,
            body.Summary, status, body.ReviewDate,
            body.TemplateId, answersJson, body.PotentialRating,
            body.FileRef, body.EmployeeType,
            ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("reviews/{id:int}")]
    public async Task<IActionResult> UpdateReviewStatus(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });
        if (!ReviewStatuses.Contains(body.Status.Trim()))
            return BadRequest(new { error = "invalid status" });

        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null or <= 0) return BadRequest(new { error = "employee profile not linked" });
            if (!await _hr.PerformanceReviewOwnedByAsync(id, self.Value, ct))
                return Forbid();
            if (!string.Equals(body.Status.Trim(), "acknowledged", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { error = "employees may only acknowledge reviews" });
        }
        else if (!await PermissionGate.HasAsync(_rbac, User, ct, "performance.view"))
        {
            return Forbid();
        }

        var row = await _hr.UpdatePerformanceReviewStatusAsync(id, body.Status.Trim(), ct);
        return row is null ? NotFound() : Ok(row);
    }

    // ==========================================
    // Task 3.2: Dynamic Assessment Templates
    // ==========================================

    [HttpGet("templates")]
    public async Task<IActionResult> Templates([FromQuery] bool? activeOnly, CancellationToken ct)
    {
        var templates = await _hr.PerformanceTemplatesAsync(activeOnly ?? true, ct);
        return Ok(templates);
    }

    [HttpPost("templates")]
    public async Task<IActionResult> CreateTemplate([FromBody] PerformanceTemplateCreateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "performance.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(body.Title))
            return BadRequest(new { error = "title required" });

        var reviewType = string.IsNullOrWhiteSpace(body.ReviewType) ? "annual" : body.ReviewType.Trim();
        if (!ReviewTypes.Contains(reviewType))
            return BadRequest(new { error = "invalid reviewType" });

        string sectionsJson = body.SectionsJson is null ? "[]"
            : (body.SectionsJson is string s ? s : JsonSerializer.Serialize(body.SectionsJson));

        var row = await _hr.CreatePerformanceTemplateAsync(
            body.Title.Trim(), body.Description, reviewType, sectionsJson, body.IsActive, body.TargetEmployeeType, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPut("templates/{id:int}")]
    public async Task<IActionResult> UpdateTemplate(int id, [FromBody] PerformanceTemplateCreateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "performance.view")) return Forbid();

        string? sectionsJson = body.SectionsJson is null ? null
            : (body.SectionsJson is string s ? s : JsonSerializer.Serialize(body.SectionsJson));

        var updated = await _hr.UpdatePerformanceTemplateAsync(
            id, body.Title, body.Description, body.ReviewType, sectionsJson, body.IsActive, body.TargetEmployeeType, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    // ==========================================
    // Task 3.3: 360-Degree Peer Feedback
    // ==========================================

    [HttpGet("peer-nominations")]
    public async Task<IActionResult> PeerNominations([FromQuery] int? reviewId, [FromQuery] int? nomineeId, CancellationToken ct)
    {
        int? reviewerId = null;
        if (CurrentUser.IsEmployee(User))
        {
            reviewerId = CurrentUser.EmployeeId(User);
            if (reviewerId is null or <= 0) return BadRequest(new { error = "employee profile not linked" });
        }
        else if (!await PermissionGate.HasAsync(_rbac, User, ct, "performance.view"))
        {
            return Forbid();
        }

        var list = await _hr.PerformancePeerNominationsAsync(reviewId, reviewerId, nomineeId, ct);
        return Ok(list);
    }

    [HttpPost("peer-nominations")]
    public async Task<IActionResult> CreatePeerNomination([FromBody] PerformancePeerNominationRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "performance.view")) return Forbid();
        if (body.ReviewId <= 0 || body.NomineeId <= 0 || body.ReviewerId <= 0)
            return BadRequest(new { error = "reviewId, nomineeId, and reviewerId required" });

        if (body.NomineeId == body.ReviewerId)
            return BadRequest(new { error = "peer reviewer cannot be the nominee themselves" });

        var row = await _hr.CreatePeerNominationAsync(body.ReviewId, body.NomineeId, body.ReviewerId, body.IsAnonymous, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("peer-nominations/{id:int}/approve")]
    public async Task<IActionResult> ApprovePeerNomination(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "performance.view")) return Forbid();
        var status = string.IsNullOrWhiteSpace(body.Status) ? "approved" : body.Status.Trim();
        if (!NominationStatuses.Contains(status))
            return BadRequest(new { error = "invalid nomination status" });

        var updated = await _hr.UpdatePeerNominationStatusAsync(id, status, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPost("peer-nominations/{id:int}/submit")]
    public async Task<IActionResult> SubmitPeerFeedback(int id, [FromBody] PerformancePeerFeedbackSubmitRequest body, CancellationToken ct)
    {
        string feedbackJson = body.FeedbackJson is null ? "{}"
            : (body.FeedbackJson is string s ? s : JsonSerializer.Serialize(body.FeedbackJson));

        var updated = await _hr.SubmitPeerFeedbackAsync(id, feedbackJson, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpGet("my-peer-reviews")]
    public async Task<IActionResult> MyPeerReviews(CancellationToken ct)
    {
        var self = CurrentUser.EmployeeId(User);
        if (self is null or <= 0)
            return BadRequest(new { error = "employee profile not linked" });

        var list = await _hr.MyPendingPeerReviewsAsync(self.Value, ct);
        return Ok(list);
    }

    // ==========================================
    // Task 3.4: Appraisal Deadline Reminders
    // ==========================================

    [HttpPost("reminders/send")]
    public async Task<IActionResult> SendReminders([FromBody] PerformanceReminderRequest? body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "performance.view")) return Forbid();

        var stage = body?.Stage ?? "Self-Evaluation / Sign-Off";
        var dueDate = body?.DueDate ?? "Upcoming Deadline";
        var reviewType = body?.ReviewType ?? "annual";

        int sentCount = 0;

        if (body?.EmployeeId is > 0)
        {
            await _email.SendPerformanceReminderAsync(body.EmployeeId.Value, reviewType, dueDate, stage, ct);
            sentCount = 1;
        }
        else
        {
            // Broadcast reminder to all employees with reviews in draft or submitted status
            var reviews = await _hr.PerformanceReviewsAsync(null, null, ct);
            var pendingReviews = reviews
                .Where(r => {
                    var st = r.TryGetValue("status", out var s) ? s?.ToString() : null;
                    return st is "draft" or "submitted";
                })
                .ToList();

            var distinctEmployeeIds = pendingReviews
                .Select(r => r.TryGetValue("employee_id", out var eid) ? Convert.ToInt32(eid) : 0)
                .Where(id => id > 0)
                .Distinct()
                .ToList();

            foreach (var empId in distinctEmployeeIds)
            {
                await _email.SendPerformanceReminderAsync(empId, reviewType, dueDate, stage, ct);
                sentCount++;
            }
        }

        return Ok(new { success = true, sentCount, message = $"Successfully dispatched {sentCount} appraisal reminder(s)." });
    }

    // ==========================================
    // Task 3.5: Performance 9-Box Grid Analytics
    // ==========================================

    [HttpGet("analytics/nine-box")]
    public async Task<IActionResult> NineBoxAnalytics(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "performance.view")) return Forbid();
        var analytics = await _hr.PerformanceNineBoxAnalyticsAsync(ct);
        return Ok(analytics);
    }

    // ==========================================
    // Task 5.2: Direct Appraisal & Goal Evidence File Uploads
    // ==========================================

    [HttpPost("upload-attachment")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadAttachment(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "no file provided" });

        if (file.Length > 15 * 1024 * 1024)
            return BadRequest(new { error = "file exceeds maximum allowed size (15MB)" });

        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var uploadsDir = Path.Combine(webRoot, "uploads", "performance");
        Directory.CreateDirectory(uploadsDir);

        var ext = Path.GetExtension(file.FileName);
        var safeName = $"{Guid.NewGuid():N}{ext}";
        var filePath = Path.Combine(uploadsDir, safeName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream, ct);
        }

        var relativeUrl = $"/uploads/performance/{safeName}";
        return Ok(new
        {
            fileUrl = relativeUrl,
            fileName = file.FileName,
            fileSize = file.Length,
            uploadedAt = DateTime.UtcNow
        });
    }
}
