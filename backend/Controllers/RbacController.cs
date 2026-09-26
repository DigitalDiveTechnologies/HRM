using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "RBAC")]
[Route("api/rbac")]
[Authorize(Roles = "super_admin,admin")]
public sealed class RbacController : ControllerBase
{
    private readonly RbacService _rbac;
    private readonly HrQueryService _hr;

    public RbacController(RbacService rbac, HrQueryService hr)
    {
        _rbac = rbac;
        _hr = hr;
    }

    [HttpGet("roles")]
    public async Task<ActionResult<IReadOnlyList<RoleDto>>> ListRoles(CancellationToken ct)
        => Ok(await _rbac.ListRolesAsync(ct));

    [HttpPost("roles")]
    public async Task<ActionResult<RoleDto>> CreateRole([FromBody] CreateRoleRequest body, CancellationToken ct)
    {
        var (role, error) = await _rbac.CreateRoleAsync(body, ct);
        if (error is not null) return BadRequest(new { error });
        return Ok(role);
    }

    [HttpPatch("roles/{id:int}")]
    public async Task<ActionResult<RoleDto>> UpdateRole(int id, [FromBody] UpdateRoleRequest body, CancellationToken ct)
    {
        var (role, error) = await _rbac.UpdateRoleAsync(id, body, ct);
        if (error is not null) return BadRequest(new { error });
        return Ok(role);
    }

    [HttpDelete("roles/{id:int}")]
    public async Task<IActionResult> DeleteRole(int id, CancellationToken ct)
    {
        var (ok, error) = await _rbac.DeleteRoleAsync(id, ct);
        if (!ok) return BadRequest(new { error });
        return Ok(new { message = "Role deleted." });
    }

    [HttpGet("permissions")]
    public async Task<ActionResult<IReadOnlyList<PermissionDto>>> ListPermissions(CancellationToken ct)
        => Ok(await _rbac.ListPermissionsAsync(ct));

    [HttpGet("permission-matrix")]
    public async Task<ActionResult<PermissionMatrixDto>> GetMatrix(CancellationToken ct)
        => Ok(await _rbac.GetPermissionMatrixAsync(ct));

    [HttpPut("permission-matrix")]
    public async Task<IActionResult> SaveMatrix([FromBody] SavePermissionMatrixRequest body, CancellationToken ct)
    {
        var (ok, error) = await _rbac.SavePermissionMatrixAsync(body, ct);
        if (!ok) return BadRequest(new { error });
        return Ok(new { message = "Permissions saved." });
    }

    [HttpGet("users")]
    public async Task<ActionResult<IReadOnlyList<RbacUserDto>>> ListUsers(CancellationToken ct)
        => Ok(await _rbac.ListUsersAsync(ct));

    [HttpPost("users")]
    public async Task<ActionResult<RbacUserDto>> CreateUser([FromBody] CreateRbacUserRequest body, CancellationToken ct)
    {
        var (user, error) = await _rbac.CreateUserAsync(body, ct);
        if (error is not null) return BadRequest(new { error });
        // Managers need an employees profile for MSS / JWT employee_id — link immediately
        if (user is not null
            && string.Equals(user.Role, "manager", StringComparison.OrdinalIgnoreCase)
            && user.EmployeeId is null)
        {
            var linked = await _hr.EnsurePortalEmployeeLinkAsync(
                user.Id, user.Email, user.DisplayName, ct);
            if (linked is > 0)
                user.EmployeeId = linked;
        }
        return Ok(user);
    }

    [HttpPatch("users/{id:int}")]
    public async Task<ActionResult<RbacUserDto>> UpdateUser(int id, [FromBody] UpdateRbacUserRequest body, CancellationToken ct)
    {
        var (user, error) = await _rbac.UpdateUserAsync(id, body, ct);
        if (error is not null) return BadRequest(new { error });
        if (user is not null
            && string.Equals(user.Role, "manager", StringComparison.OrdinalIgnoreCase)
            && user.EmployeeId is null)
        {
            var linked = await _hr.EnsurePortalEmployeeLinkAsync(
                user.Id, user.Email, user.DisplayName, ct);
            if (linked is > 0)
                user.EmployeeId = linked;
        }
        return Ok(user);
    }

    [HttpDelete("users/{id:int}")]
    public async Task<IActionResult> DeleteUser(int id, CancellationToken ct)
    {
        var (ok, error) = await _rbac.DeleteUserAsync(id, ct);
        if (!ok) return BadRequest(new { error });
        return Ok(new { message = "User deleted." });
    }
}
