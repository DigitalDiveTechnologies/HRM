using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Training")]
[Route("api/training")]
[Authorize(Roles = "admin,manager")]
public sealed class TrainingController : ControllerBase
{
    private static readonly HashSet<string> CourseStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "active", "archived"
    };

    private static readonly HashSet<string> EnrollmentStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "assigned", "in_progress", "completed", "cancelled"
    };

    private static readonly HashSet<string> CertStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "valid", "expired", "revoked"
    };

    private readonly HrQueryService _hr;

    public TrainingController(HrQueryService hr) => _hr = hr;

    [HttpGet("courses")]
    public async Task<IActionResult> Courses(CancellationToken ct) =>
        Ok(await _hr.CoursesAsync(ct));

    [HttpPost("courses")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateCourse([FromBody] CourseCreateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Title))
            return BadRequest(new { error = "title required" });

        var status = string.IsNullOrWhiteSpace(body.Status) ? "active" : body.Status.Trim();
        if (!CourseStatuses.Contains(status))
            return BadRequest(new { error = "invalid status" });

        var row = await _hr.CreateCourseAsync(
            body.Title.Trim(), body.Category, body.DurationHours, body.Description, status, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("courses/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdateCourseStatus(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status) || !CourseStatuses.Contains(body.Status.Trim()))
            return BadRequest(new { error = "invalid status" });
        var row = await _hr.UpdateCourseStatusAsync(id, body.Status.Trim(), ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet("enrollments")]
    public async Task<IActionResult> Enrollments(CancellationToken ct) =>
        Ok(await _hr.CourseEnrollmentsAsync(ct));

    [HttpPost("enrollments")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateEnrollment([FromBody] EnrollmentCreateRequest body, CancellationToken ct)
    {
        if (body.CourseId <= 0 || body.EmployeeId <= 0)
            return BadRequest(new { error = "courseId and employeeId required" });

        var status = string.IsNullOrWhiteSpace(body.Status) ? "assigned" : body.Status.Trim();
        if (!EnrollmentStatuses.Contains(status))
            return BadRequest(new { error = "invalid status" });

        try
        {
            var row = await _hr.CreateEnrollmentAsync(body.CourseId, body.EmployeeId, body.DueDate, status, ct);
            return StatusCode(StatusCodes.Status201Created, row);
        }
        catch (Npgsql.PostgresException ex) when (ex.SqlState == "23505")
        {
            return Conflict(new { error = "employee already enrolled in this course" });
        }
    }

    [HttpPatch("enrollments/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdateEnrollment(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status) || !EnrollmentStatuses.Contains(body.Status.Trim()))
            return BadRequest(new { error = "invalid status" });
        var row = await _hr.UpdateEnrollmentStatusAsync(id, body.Status.Trim(), ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet("certifications")]
    public async Task<IActionResult> Certifications(CancellationToken ct) =>
        Ok(await _hr.CertificationsAsync(ct));

    [HttpPost("certifications")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateCertification([FromBody] CertificationCreateRequest body, CancellationToken ct)
    {
        if (body.EmployeeId <= 0)
            return BadRequest(new { error = "employeeId required" });
        if (string.IsNullOrWhiteSpace(body.Name))
            return BadRequest(new { error = "name required" });

        var status = string.IsNullOrWhiteSpace(body.Status) ? "valid" : body.Status.Trim();
        if (!CertStatuses.Contains(status))
            return BadRequest(new { error = "invalid status" });

        var row = await _hr.CreateCertificationAsync(
            body.EmployeeId, body.Name.Trim(), body.Issuer, body.IssuedOn, body.ExpiresOn, status, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("certifications/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdateCertification(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status) || !CertStatuses.Contains(body.Status.Trim()))
            return BadRequest(new { error = "invalid status" });
        var row = await _hr.UpdateCertificationStatusAsync(id, body.Status.Trim(), ct);
        return row is null ? NotFound() : Ok(row);
    }
}
