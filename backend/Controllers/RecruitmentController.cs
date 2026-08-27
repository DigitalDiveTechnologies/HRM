using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Recruitment")]
[Route("api/recruitment")]
[Authorize(Roles = "admin,manager")]
public sealed class RecruitmentController : ControllerBase
{
    private readonly HrQueryService _hr;

    public RecruitmentController(HrQueryService hr) => _hr = hr;

    [HttpGet("jobs")]
    public async Task<IActionResult> Jobs(CancellationToken ct) =>
        Ok(await _hr.JobPostingsAsync(ct));

    [HttpPost("jobs")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateJob([FromBody] JobPostingCreateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Title))
            return BadRequest(new { error = "title required" });

        var row = await _hr.CreateJobPostingAsync(
            body.Title, body.Department, body.Location, body.EmploymentType,
            body.Description, body.Status, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("jobs/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdateJob(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });
        var row = await _hr.UpdateJobStatusAsync(id, body.Status, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet("candidates")]
    public async Task<IActionResult> Candidates([FromQuery] int? jobId, CancellationToken ct) =>
        Ok(await _hr.CandidatesAsync(jobId, ct));

    [HttpPost("candidates")]
    public async Task<IActionResult> CreateCandidate([FromBody] CandidateCreateRequest body, CancellationToken ct)
    {
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
        if (string.IsNullOrWhiteSpace(body.Stage))
            return BadRequest(new { error = "stage required" });
        var row = await _hr.UpdateCandidateStageAsync(id, body.Stage, body.Notes, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet("interviews")]
    public async Task<IActionResult> Interviews(CancellationToken ct) =>
        Ok(await _hr.InterviewsAsync(ct));

    [HttpPost("interviews")]
    public async Task<IActionResult> CreateInterview([FromBody] InterviewCreateRequest body, CancellationToken ct)
    {
        if (body.CandidateId <= 0 || string.IsNullOrWhiteSpace(body.ScheduledAt))
            return BadRequest(new { error = "candidateId and scheduledAt required" });

        var row = await _hr.CreateInterviewAsync(
            body.CandidateId, body.ScheduledAt, body.Interviewer, body.Mode, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpGet("offers")]
    public async Task<IActionResult> Offers(CancellationToken ct) =>
        Ok(await _hr.OffersAsync(ct));

    [HttpPost("offers")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateOffer([FromBody] OfferCreateRequest body, CancellationToken ct)
    {
        if (body.CandidateId <= 0)
            return BadRequest(new { error = "candidateId required" });

        var row = await _hr.CreateOfferAsync(
            body.CandidateId, body.Salary, body.Currency, body.JoinDate, body.Status, body.LetterRef, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("offers/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdateOffer(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });
        var row = await _hr.UpdateOfferStatusAsync(id, body.Status, ct);
        return row is null ? NotFound() : Ok(row);
    }
}
