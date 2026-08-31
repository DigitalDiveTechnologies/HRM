using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Divisions")]
[Route("api/divisions")]
[Authorize(Roles = "admin")]
public sealed class DivisionsController : ControllerBase
{
    private readonly HrQueryService _hr;

    public DivisionsController(HrQueryService hr) => _hr = hr;

    /// <summary>List divisions. Pass activeOnly=true for employee form dropdowns.</summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool activeOnly = false, CancellationToken ct = default) =>
        Ok(await _hr.DivisionsAsync(activeOnly, ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var row = await _hr.DivisionByIdAsync(id, ct);
        return row is null ? NotFound(new { error = "Division not found." }) : Ok(row);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDivisionRequest body, CancellationToken ct)
    {
        var (row, error) = await _hr.CreateDivisionAsync(body.Code, body.Name, body.PayrollType ?? "wps", ct);
        if (error is not null) return BadRequest(new { error });
        return StatusCode(StatusCodes.Status201Created, row);
    }

    /// <summary>Update division fields. Set status=inactive to soft-delete (hard delete not allowed).</summary>
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateDivisionRequest body, CancellationToken ct)
    {
        var (row, error) = await _hr.UpdateDivisionAsync(id, body.Name, body.PayrollType, body.Status, ct);
        if (error is not null)
        {
            return error.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error })
                : BadRequest(new { error });
        }

        return Ok(row);
    }
}
