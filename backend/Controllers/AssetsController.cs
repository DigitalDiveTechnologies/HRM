using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Assets")]
[Route("api/assets")]
[Authorize]
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
    private readonly RbacService _rbac;

    public AssetsController(HrQueryService hr, RbacService rbac)
    {
        _hr = hr;
        _rbac = rbac;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "assets.view")) return Forbid();
        return Ok(await _hr.AssetsAsync(ct));
    }

    [HttpGet("assignments")]
    public async Task<IActionResult> Assignments(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "assets.view")) return Forbid();
        return Ok(await _hr.AssetAssignmentsAsync(ct));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] AssetCreateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "assets.view")) return Forbid();
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
    public async Task<IActionResult> Assign(int id, [FromBody] AssetAssignRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "assets.view")) return Forbid();
        if (body.EmployeeId <= 0)
            return BadRequest(new { error = "employeeId required" });

        var row = await _hr.AssignAssetAsync(id, body.EmployeeId, body.Notes, ct);
        return row is null ? NotFound(new { error = "asset not available" }) : StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("assignments/{id:int}/return")]
    public async Task<IActionResult> ReturnAssignment(int id, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "assets.view")) return Forbid();
        var row = await _hr.ReturnAssetAssignmentAsync(id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "assets.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(body.Status) || !Statuses.Contains(body.Status.Trim()))
            return BadRequest(new { error = "invalid status" });
        var row = await _hr.UpdateAssetStatusAsync(id, body.Status.Trim(), ct);
        return row is null ? NotFound() : Ok(row);
    }
}
