using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Recruitment")]
[Route("api/recruitment")]
[Authorize]
public sealed class RecruitmentController : ControllerBase
{
    private readonly HrQueryService _hr;
    private readonly RbacService _rbac;

    public RecruitmentController(HrQueryService hr, RbacService rbac)
    {
        _hr = hr;
        _rbac = rbac;
    }

    [HttpGet("jobs")]
    public async Task<IActionResult> Jobs(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "recruitment.view")) return Forbid();
        return Ok(await _hr.JobPostingsAsync(ct));
    }

    [HttpPost("jobs")]
    public async Task<IActionResult> CreateJob([FromBody] JobPostingCreateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "recruitment.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(body.Title))
            return BadRequest(new { error = "title required" });

        var row = await _hr.CreateJobPostingAsync(
            body.Title, body.Department, body.Location, body.EmploymentType,
            body.Description, body.Status, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("jobs/{id:int}")]
    public async Task<IActionResult> UpdateJob(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "recruitment.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });
        var row = await _hr.UpdateJobStatusAsync(id, body.Status, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet("candidates")]
    public async Task<IActionResult> Candidates([FromQuery] int? jobId, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "recruitment.view")) return Forbid();
        return Ok(await _hr.CandidatesAsync(jobId, ct));
    }

    [HttpPost("candidates")]
    public async Task<IActionResult> CreateCandidate([FromBody] CandidateCreateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "recruitment.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(body.FullName) || string.IsNullOrWhiteSpace(body.Email))
            return BadRequest(new { error = "fullName and email required" });

        var row = await _hr.CreateCandidateAsync(
            body.JobId, body.FullName, body.Email, body.Phone, body.ResumeRef,
            body.Source, body.Stage, body.Notes, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("candidates/{id:int}")]
    public async Task<IActionResult> UpdateCandidate(int id, [FromBody] CandidateStageUpdateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "recruitment.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(body.Stage))
            return BadRequest(new { error = "stage required" });
        var row = await _hr.UpdateCandidateStageAsync(id, body.Stage, body.Notes, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet("interviews")]
    public async Task<IActionResult> Interviews(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "recruitment.view")) return Forbid();
        return Ok(await _hr.InterviewsAsync(ct));
    }

    [HttpPost("interviews")]
    public async Task<IActionResult> CreateInterview([FromBody] InterviewCreateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "recruitment.view")) return Forbid();
        if (body.CandidateId <= 0 || string.IsNullOrWhiteSpace(body.ScheduledAt))
            return BadRequest(new { error = "candidateId and scheduledAt required" });

        var row = await _hr.CreateInterviewAsync(
            body.CandidateId, body.ScheduledAt, body.Interviewer, body.Mode, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpGet("offers")]
    public async Task<IActionResult> Offers(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "recruitment.view")) return Forbid();
        return Ok(await _hr.OffersAsync(ct));
    }

    [HttpPost("offers")]
    public async Task<IActionResult> CreateOffer([FromBody] OfferCreateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "recruitment.view")) return Forbid();
        if (body.CandidateId <= 0)
            return BadRequest(new { error = "candidateId required" });

        var row = await _hr.CreateOfferAsync(
            body.CandidateId, body.Salary, body.Currency, body.JoinDate, body.Status, body.LetterRef, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("offers/{id:int}")]
    public async Task<IActionResult> UpdateOffer(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "recruitment.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });
        var row = await _hr.UpdateOfferStatusAsync(id, body.Status, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost("candidates/{id:int}/screen")]
    public async Task<IActionResult> Screen(int id, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "recruitment.view")) return Forbid();
        try
        {
            return Ok(await _hr.ScreenResumeAsync(id, ct));
        }
        catch (InvalidOperationException)
        {
            return NotFound(new { error = "candidate not found" });
        }
    }

    // ==========================================
    // Task 5.1: Dynamic Employment Offer Letter Generator
    // ==========================================

    [HttpGet("candidates/{id:int}/offer")]
    public async Task<IActionResult> GetCandidateOffer(int id, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "recruitment.view")) return Forbid();
        var offer = await _hr.GetCandidateOfferAsync(id, ct);
        return offer is null ? NotFound(new { error = "Offer not found for candidate" }) : Ok(offer);
    }

    [HttpPost("candidates/{id:int}/offer")]
    public async Task<IActionResult> SaveCandidateOffer(int id, [FromBody] CandidateOfferRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "recruitment.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(body.JobTitle))
            return BadRequest(new { error = "Job title is required" });
        if (body.BasicSalary <= 0)
            return BadRequest(new { error = "Basic salary must be greater than zero" });

        var designation = !string.IsNullOrWhiteSpace(body.JobTitle) ? body.JobTitle.Trim() : (!string.IsNullOrWhiteSpace(body.Designation) ? body.Designation.Trim() : "Staff Position");
        var joiningDate = !string.IsNullOrWhiteSpace(body.JoinDate) ? body.JoinDate.Trim() : (!string.IsNullOrWhiteSpace(body.JoiningDate) ? body.JoiningDate.Trim() : DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd"));
        var probationMonths = body.ProbationPeriodMonths > 0 ? body.ProbationPeriodMonths : 6;
        var contractType = string.IsNullOrWhiteSpace(body.ContractType) ? "limited" : body.ContractType.Trim();
        var status = string.IsNullOrWhiteSpace(body.Status) ? "issued" : body.Status.Trim();

        var offer = await _hr.CreateOrUpdateCandidateOfferAsync(
            id,
            body.JobId,
            designation,
            body.BasicSalary,
            body.HousingAllowance,
            body.TransportAllowance,
            joiningDate,
            probationMonths,
            contractType,
            status,
            null,
            ct);

        return Ok(offer);
    }

    [HttpGet("candidates/{id:int}/offer/pdf")]
    public async Task<IActionResult> GetCandidateOfferPdf(int id, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "recruitment.view")) return Forbid();
        var offer = await _hr.GetCandidateOfferAsync(id, ct);
        if (offer is null)
            return NotFound(new { error = "Offer not found for candidate" });

        var html = offer.TryGetValue("offer_html", out var h) ? h?.ToString() ?? "" : "";
        return Content(html, "text/html; charset=utf-8");
    }
}
