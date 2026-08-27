using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Assets")]
[Route("api/assets")]
[Authorize(Roles = "admin,manager")]
public sealed class AssetsController : ControllerBase
{
    private static readonly HashSet<string> Categories = new(StringComparer.OrdinalIgnoreCase)
    {
        "laptop", "phone", "access_card", "other"
    };

    private static readonly HashSet<string> Statuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "available", "assigned", "retired", "lost"
    };

    private readonly HrQueryService _hr;

    public AssetsController(HrQueryService hr) => _hr = hr;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) =>
        Ok(await _hr.AssetsAsync(ct));

    [HttpGet("assignments")]
    public async Task<IActionResult> Assignments(CancellationToken ct) =>
        Ok(await _hr.AssetAssignmentsAsync(ct));

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create([FromBody] AssetCreateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.AssetTag) || string.IsNullOrWhiteSpace(body.Name))
            return BadRequest(new { error = "assetTag and name required" });

        var category = string.IsNullOrWhiteSpace(body.Category) ? "laptop" : body.Category.Trim();
        if (!Categories.Contains(category))
            return BadRequest(new { error = "invalid category" });

        var status = string.IsNullOrWhiteSpace(body.Status) ? "available" : body.Status.Trim();
        if (!Statuses.Contains(status))
            return BadRequest(new { error = "invalid status" });

        try
        {
            var row = await _hr.CreateAssetAsync(body.AssetTag.Trim(), body.Name.Trim(), category, body.SerialNo, status, ct);
            return StatusCode(StatusCodes.Status201Created, row);
        }
        catch (Npgsql.PostgresException ex) when (ex.SqlState == "23505")
        {
            return Conflict(new { error = "assetTag already exists" });
        }
    }

    [HttpPost("{id:int}/assign")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Assign(int id, [FromBody] AssetAssignRequest body, CancellationToken ct)
    {
        if (body.EmployeeId <= 0)
            return BadRequest(new { error = "employeeId required" });

        var row = await _hr.AssignAssetAsync(id, body.EmployeeId, body.Notes, ct);
        return row is null ? NotFound(new { error = "asset not available" }) : StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("assignments/{id:int}/return")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ReturnAssignment(int id, CancellationToken ct)
    {
        var row = await _hr.ReturnAssetAssignmentAsync(id, ct);
        return row is null ? NotFound() : Ok(row);
    }
}
