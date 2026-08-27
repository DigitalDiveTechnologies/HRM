using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Documents")]
[Route("api/documents")]
[Authorize(Roles = "admin,manager")]
public sealed class DocumentsController : ControllerBase
{
    private readonly HrQueryService _hr;

    public DocumentsController(HrQueryService hr) => _hr = hr;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await _hr.DocumentsAsync(ct));

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create([FromBody] DocumentCreateRequest body, CancellationToken ct)
    {
        if (body.EmployeeId <= 0)
            return BadRequest(new { error = "employeeId required" });
        if (string.IsNullOrWhiteSpace(body.DocType) || string.IsNullOrWhiteSpace(body.Title))
            return BadRequest(new { error = "docType and title required" });

        var row = await _hr.CreateDocumentAsync(
            body.EmployeeId,
            body.DocType.Trim(),
            body.Title.Trim(),
            body.FileRef,
            body.IssueDate,
            body.ExpiryDate,
            body.Status,
            ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }
}
