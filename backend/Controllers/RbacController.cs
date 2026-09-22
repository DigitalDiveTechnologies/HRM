using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "RBAC")]
[Route("api/rbac")]
[Authorize(Roles = "super_admin")]
public sealed class RbacController : ControllerBase
{
    private readonly RbacService _rbac;

    public RbacController(RbacService rbac) => _rbac = rbac;

    [HttpGet("roles")]
    public async Task<ActionResult<IReadOnlyList<RoleDto>>> ListRoles(CancellationToken ct)
        => Ok(await _rbac.ListRolesAsync(ct));

    [HttpGet("users")]
    public async Task<ActionResult<IReadOnlyList<RbacUserDto>>> ListUsers(CancellationToken ct)
        => Ok(await _rbac.ListUsersAsync(ct));

    [HttpPost("users")]
    public async Task<ActionResult<RbacUserDto>> CreateUser([FromBody] CreateRbacUserRequest body, CancellationToken ct)
    {
        var (user, error) = await _rbac.CreateUserAsync(body, ct);
        if (error is not null) return BadRequest(new { error });
        return Ok(user);
    }

    [HttpPatch("users/{id:int}")]
    public async Task<ActionResult<RbacUserDto>> UpdateUser(int id, [FromBody] UpdateRbacUserRequest body, CancellationToken ct)
    {
        var (user, error) = await _rbac.UpdateUserAsync(id, body, ct);
        if (error is not null) return BadRequest(new { error });
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
