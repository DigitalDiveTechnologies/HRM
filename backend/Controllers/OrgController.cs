using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Org")]
[Route("api/org")]
[Authorize(Roles = "admin,manager")]
public sealed class OrgController : ControllerBase
{
    private readonly HrQueryService _hr;
    private readonly OrgFoundationService _org;
    public OrgController(HrQueryService hr, OrgFoundationService org)
    {
        _hr = hr;
        _org = org;
    }

    /// <summary>Position-based org chart (Blueprint v1.1). Falls back to employee manager_id chart if no positions.</summary>
    [HttpGet("chart")]
    public async Task<IActionResult> Chart(CancellationToken ct)
    {
        var positions = await _org.PositionChartAsync(ct);
        if (positions.Count > 0) return Ok(positions);
        return Ok(await _hr.OrgChartAsync(ct));
    }

    [HttpGet("history/{employeeId:int}")]
    public async Task<IActionResult> History(int employeeId, CancellationToken ct) =>
        Ok(await _hr.EmploymentHistoryAsync(employeeId, ct));

    [HttpPost("history")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateHistory([FromBody] EmploymentHistoryCreateRequest body, CancellationToken ct)
    {
        if (body.EmployeeId <= 0 || string.IsNullOrWhiteSpace(body.JobTitle) || string.IsNullOrWhiteSpace(body.StartDate))
            return BadRequest(new { error = "employeeId, jobTitle, startDate required" });
        var row = await _hr.CreateEmploymentHistoryAsync(
            body.EmployeeId, body.JobTitle.Trim(), body.DepartmentName, body.ManagerName,
            body.StartDate, body.EndDate, body.Notes, ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpGet("skills")]
    public async Task<IActionResult> Skills(CancellationToken ct) => Ok(await _hr.SkillsAsync(ct));

    [HttpGet("employee-skills")]
    public async Task<IActionResult> EmployeeSkills(CancellationToken ct) => Ok(await _hr.EmployeeSkillsAsync(ct));

    [HttpPost("employee-skills")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AssignSkill([FromBody] EmployeeSkillAssignRequest body, CancellationToken ct)
    {
        if (body.EmployeeId <= 0 || body.SkillId <= 0)
            return BadRequest(new { error = "employeeId and skillId required" });
        await _hr.AssignEmployeeSkillAsync(body.EmployeeId, body.SkillId, body.Level, ct);
        return Ok(new { ok = true });
    }
}
