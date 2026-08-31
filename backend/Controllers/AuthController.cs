using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Auth")]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly AuthService _auth;
    private readonly JwtTokenService _jwt;

    public AuthController(AuthService auth, JwtTokenService jwt)
    {
        _auth = auth;
        _jwt = jwt;
    }

    /// <summary>Login — returns JWT Bearer token. Passwords are verified with BCrypt.</summary>
    [AllowAnonymous]
    [HttpPost("login")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "Email and password are required." });
        }

        var user = await _auth.ValidateLoginAsync(request.Email, request.Password, ct);
        if (user is null)
        {
            return Unauthorized(new { error = "Invalid email or password." });
        }

        if (string.Equals(user.Role, "employee", StringComparison.OrdinalIgnoreCase) && user.EmployeeId is null)
        {
            return Unauthorized(new { error = "This login is not linked to an employee profile. Ask HR admin to recreate the account." });
        }

        var (token, expiresMinutes) = _jwt.CreateToken(user);

        return Ok(new LoginResponse
        {
            Token = token,
            TokenType = "Bearer",
            ExpiresInMinutes = expiresMinutes,
            User = new UserDto
            {
                Id = user.Id,
                Email = user.Email,
                Role = user.Role,
                EmployeeId = user.EmployeeId,
                FullName = user.FullName,
                JobTitle = user.JobTitle,
            }
        });
    }

    /// <summary>Current user from JWT.</summary>
    [Authorize]
    [HttpGet("me")]
    public IActionResult Me()
    {
        return Ok(new
        {
            id = CurrentUser.UserId(User),
            email = CurrentUser.Email(User),
            role = CurrentUser.Role(User),
            employeeId = CurrentUser.EmployeeId(User),
            fullName = CurrentUser.Name(User),
        });
    }

    /// <summary>Change password (stores BCrypt hash).</summary>
    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest body, CancellationToken ct)
    {
        var idRaw = CurrentUser.UserId(User);
        if (!int.TryParse(idRaw, out var userId))
        {
            return Unauthorized();
        }

        var (ok, error) = await _auth.ChangePasswordAsync(userId, body.CurrentPassword, body.NewPassword, ct);
        if (!ok) return BadRequest(new { error });
        return Ok(new { message = "Password updated." });
    }

    /// <summary>
    /// Admin only — hash any remaining plaintext passwords in DB (one-time migration).
    /// </summary>
    [Authorize(Roles = "admin")]
    [HttpPost("hash-passwords")]
    public async Task<IActionResult> HashPasswords(CancellationToken ct)
    {
        var count = await _auth.HashAllPlaintextPasswordsAsync(ct);
        return Ok(new { hashed = count, message = count == 0 ? "All passwords already hashed." : $"Hashed {count} plaintext password(s)." });
    }
}
