using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Organisation")]
[Route("api/org")]
[Authorize(Roles = "admin,manager")]
public sealed class OrgFoundationController : ControllerBase
{
    private readonly OrgFoundationService _org;
    private readonly HrQueryService _hr;

    public OrgFoundationController(OrgFoundationService org, HrQueryService hr)
    {
        _org = org;
        _hr = hr;
    }

    [HttpGet("legal-entities")]
    public async Task<IActionResult> LegalEntities(CancellationToken ct) =>
        Ok(await _org.LegalEntitiesAsync(ct));

    [HttpPost("legal-entities")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateLegalEntity([FromBody] LegalEntityCreateRequest body, CancellationToken ct)
    {
        var (row, error) = await _org.CreateLegalEntityAsync(body, ct);
        if (error is not null) return BadRequest(new { error });
        await _hr.WriteAuditAsync(User.FindFirst("email")?.Value, User.FindFirst("role")?.Value,
            "create", "legal_entity", Convert.ToInt32(row!["id"]), body.Code, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpGet("branches")]
    public async Task<IActionResult> Branches([FromQuery] int? legalEntityId, CancellationToken ct) =>
        Ok(await _org.BranchesAsync(legalEntityId, ct));

    [HttpPost("branches")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateBranch([FromBody] BranchCreateRequest body, CancellationToken ct)
    {
        var (row, error) = await _org.CreateBranchAsync(body, ct);
        if (error is not null) return BadRequest(new { error });
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpGet("positions")]
    public async Task<IActionResult> Positions([FromQuery] int? legalEntityId, [FromQuery] string? status, CancellationToken ct) =>
        Ok(await _org.PositionsAsync(legalEntityId, status, ct));

    [HttpPost("positions")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreatePosition([FromBody] PositionCreateRequest body, CancellationToken ct)
    {
        var (row, error) = await _org.CreatePositionAsync(body, ct);
        if (error is not null) return BadRequest(new { error });
        await _hr.WriteAuditAsync(User.FindFirst("email")?.Value, User.FindFirst("role")?.Value,
            "create", "position", Convert.ToInt32(row!["id"]), body.Code, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("positions/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdatePosition(int id, [FromBody] PositionUpdateRequest body, CancellationToken ct)
    {
        var (row, error) = await _org.UpdatePositionAsync(id, body, ct);
        if (error is not null)
            return error.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error })
                : BadRequest(new { error });
        await _hr.WriteAuditAsync(User.FindFirst("email")?.Value, User.FindFirst("role")?.Value,
            "update", "position", id, body.Status ?? body.Title, ct);
        return Ok(row);
    }

    [HttpPost("assignments")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateAssignment([FromBody] AssignmentCreateRequest body, CancellationToken ct)
    {
        var (row, error) = await _org.CreateAssignmentAsync(body, ct);
        if (error is not null) return BadRequest(new { error });
        await _hr.WriteAuditAsync(User.FindFirst("email")?.Value, User.FindFirst("role")?.Value,
            "assign", "position_assignment", Convert.ToInt32(row!["id"]),
            $"position={body.PositionId};employee={body.EmployeeId}", ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpGet("headcount")]
    public async Task<IActionResult> Headcount(CancellationToken ct) =>
        Ok(await _org.HeadcountAsync(ct));
}
