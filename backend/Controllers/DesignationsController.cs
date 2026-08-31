using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Designations")]
[Route("api/designations")]
[Authorize(Roles = "admin")]
public sealed class DesignationsController : ControllerBase
{
    private readonly HrQueryService _hr;

    public DesignationsController(HrQueryService hr) => _hr = hr;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool activeOnly = false, CancellationToken ct = default) =>
        Ok(await _hr.DesignationsAsync(activeOnly, ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateMasterRequest body, CancellationToken ct)
    {
        var (row, error) = await _hr.CreateDesignationAsync(body.Name, ct);
        if (error is not null) return BadRequest(new { error });
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateMasterRequest body, CancellationToken ct)
    {
        var (row, error) = await _hr.UpdateDesignationAsync(id, body.Name, body.Status, ct);
        if (error is not null)
        {
            return error.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error })
                : BadRequest(new { error });
        }

        return Ok(row);
    }
}
