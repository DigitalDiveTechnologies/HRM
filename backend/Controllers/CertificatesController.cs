using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Certificates")]
[Route("api/certificates")]
[Authorize(Roles = "admin,manager,employee")]
public sealed class CertificatesController : ControllerBase
{
    private readonly HrQueryService _hr;
    private readonly IWebHostEnvironment _env;

    public CertificatesController(HrQueryService hr, IWebHostEnvironment env)
    {
        _hr = hr;
        _env = env;
    }

    [HttpGet("types")]
    public IActionResult Types() => Ok(new[]
    {
        new { id = "bank", label = "Bank Certificate" },
        new { id = "salary", label = "Salary Certificate" },
        new { id = "noc_travel", label = "NOC (Travel)" }
    });

    [HttpGet("prefill")]
    public async Task<IActionResult> Prefill(CancellationToken ct)
    {
        var self = CurrentUser.EmployeeId(User);
        if (self is null or <= 0) return Forbid();
        var row = await _hr.CertificatePrefillAsync(self.Value, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        int? only = CurrentUser.IsEmployee(User) ? CurrentUser.EmployeeId(User) : null;
        if (CurrentUser.IsEmployee(User) && only is null) return Forbid();
        return Ok(await _hr.CertificatesAsync(only, ct));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CertificateCreateRequest body, CancellationToken ct)
    {
        var employeeId = body.EmployeeId;
        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null || self.Value != employeeId) return Forbid();
        }

        if (string.IsNullOrWhiteSpace(body.CertificateType))
            return BadRequest(new { error = "certificateType required" });

        var type = body.CertificateType.Trim().ToLowerInvariant();
        if (type is not ("bank" or "salary" or "noc_travel"))
            return BadRequest(new { error = "certificateType must be bank, salary, or noc_travel" });

        if (type == "bank" && string.IsNullOrWhiteSpace(body.BankName))
            return BadRequest(new { error = "bankName required for bank certificate" });

        if (type == "noc_travel" && string.IsNullOrWhiteSpace(body.TravelDestination))
            return BadRequest(new { error = "travelDestination required for NOC (Travel)" });

        var (row, error) = await _hr.CreateCertificateAsync(
            employeeId, type, body.Purpose, body.BankName, body.TravelDestination, ct);
        if (error is not null) return BadRequest(new { error });
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Decide(int id, [FromBody] CertificateDecisionRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "status required" });

        var status = body.Status.Trim().ToLowerInvariant();
        if (status is not ("approved" or "rejected"))
            return BadRequest(new { error = "status must be approved or rejected" });

        var row = await _hr.UpdateCertificateStatusAsync(id, status, body.HrNote, ct);
        return row is null ? NotFound(new { error = "Request not found or not pending." }) : Ok(row);
    }

    [HttpPost("{id:int}/issue")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Issue(int id, CancellationToken ct)
    {
        var row = await _hr.IssueCertificateAsync(id, _env.ContentRootPath, ct);
        return row is null
            ? NotFound(new { error = "Request not found or cannot be issued." })
            : Ok(row);
    }

    [HttpGet("{id:int}/file")]
    public async Task<IActionResult> DownloadFile(int id, CancellationToken ct)
    {
        var row = await _hr.CertificateByIdAsync(id, ct);
        if (row is null) return NotFound();

        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            var owner = row.GetValueOrDefault("employeeId") ?? row.GetValueOrDefault("employee_id");
            if (self is null || owner is null || Convert.ToInt32(owner) != self.Value)
                return Forbid();
        }

        var fileRef = Convert.ToString(row.GetValueOrDefault("fileRef") ?? row.GetValueOrDefault("file_ref"));
        if (string.IsNullOrWhiteSpace(fileRef))
            return NotFound(new { error = "Certificate file not generated yet." });

        var path = Path.Combine(_env.ContentRootPath, "wwwroot", fileRef.Replace('/', Path.DirectorySeparatorChar));
        if (!System.IO.File.Exists(path))
            return NotFound(new { error = "Certificate file missing on server." });

        var bytes = await System.IO.File.ReadAllBytesAsync(path, ct);
        var downloadName = $"GOCs-Certificate-{id}.html";
        return File(bytes, "text/html; charset=utf-8", downloadName);
    }
}
