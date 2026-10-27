using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Approvals")]
[Route("api/approvals")]
[Authorize]
public sealed class ApprovalsController : ControllerBase
{
    private readonly HrQueryService _hr;
    private readonly RbacService _rbac;

    public ApprovalsController(HrQueryService hr, RbacService rbac)
    {
        _hr = hr;
        _rbac = rbac;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "approvals.view")) return Forbid();
        return Ok(await _hr.ApprovalsAsync(ct));
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] StatusUpdateRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "approvals.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(body.Status)) return BadRequest(new { error = "status required" });
        var row = await _hr.UpdateApprovalAsync(id, body.Status, ct);
        return row is null ? NotFound() : Ok(row);
    }

    // ==========================================
    // Task 5.6: Configurable Multi-Tier Approval Rules & Escalation Routing
    // ==========================================

    [HttpGet("rules")]
    public async Task<IActionResult> ListRules(CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "approvals.view")) return Forbid();
        return Ok(await _hr.ApprovalRoutingRulesAsync(ct));
    }

    [HttpPost("rules")]
    public async Task<IActionResult> SaveRule([FromBody] ApprovalRoutingRuleRequest body, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "approvals.view")) return Forbid();
        if (string.IsNullOrWhiteSpace(body.RequestType))
            return BadRequest(new { error = "requestType required" });

        var rule = await _hr.CreateOrUpdateApprovalRoutingRuleAsync(
            body.Id,
            body.RequestType.Trim().ToLowerInvariant(),
            body.DepartmentId,
            body.MinThreshold,
            body.MaxThreshold,
            body.LevelsCount < 1 ? 1 : body.LevelsCount,
            string.IsNullOrWhiteSpace(body.ApproverRole) ? "manager" : body.ApproverRole.Trim().ToLowerInvariant(),
            body.IsActive,
            ct);

        return Ok(rule);
    }

    [HttpDelete("rules/{id:int}")]
    public async Task<IActionResult> DeleteRule(int id, CancellationToken ct)
    {
        if (!await PermissionGate.HasAsync(_rbac, User, ct, "approvals.view")) return Forbid();
        var deleted = await _hr.DeleteApprovalRoutingRuleAsync(id, ct);
        return deleted ? Ok(new { success = true, message = "Routing rule deleted" }) : NotFound();
    }
}
