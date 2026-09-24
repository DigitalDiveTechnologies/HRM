using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using DigitalDive.Hr.Api.Models;
using Microsoft.IdentityModel.Tokens;

namespace DigitalDive.Hr.Api.Services;

public sealed class JwtTokenService
{
    private readonly IConfiguration _config;

    public JwtTokenService(IConfiguration config)
    {
        _config = config;
    }

    public (string Token, int ExpiresMinutes) CreateToken(UserRecord user)
    {
        var jwt = _config.GetSection("Jwt");
        var expiresMinutes = int.TryParse(jwt["ExpiresMinutes"], out var m) ? m : 480;
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwt["Key"] ?? "DigitalDive-HR-Dev-Key-Change-In-Production-Min-32-Chars"));

        // Short claim types only — matches MapInboundClaims=false + RoleClaimType="role"
        var role = (user.Role ?? string.Empty).Trim().ToLowerInvariant();
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new("role", user.Role),
            // Real app role — never overwritten by synthetic admin companion below
            new("app_role", string.IsNullOrWhiteSpace(user.Role) ? "employee" : user.Role.Trim()),
        };

        // Admin-portal staff (system extras + custom roles) need [Authorize(Roles="admin")]
        if (role == "super_admin"
            || (role.Length > 0 && role != "admin" && role != "manager" && role != "employee"))
        {
            claims.Add(new Claim("role", "admin"));
        }

        if (user.EmployeeId.HasValue)
        {
            claims.Add(new Claim("employee_id", user.EmployeeId.Value.ToString()));
        }

        if (!string.IsNullOrWhiteSpace(user.FullName))
        {
            claims.Add(new Claim("name", user.FullName));
        }

        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"] ?? "DigitalDive.Hr",
            audience: jwt["Audience"] ?? "DigitalDive.Hr.Clients",
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiresMinutes),
            signingCredentials: credentials);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresMinutes);
    }
}
