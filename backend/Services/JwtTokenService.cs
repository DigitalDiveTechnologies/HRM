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

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role),
            new("role", user.Role),
        };

        if (user.EmployeeId.HasValue)
        {
            claims.Add(new Claim("employee_id", user.EmployeeId.Value.ToString()));
        }

        if (!string.IsNullOrWhiteSpace(user.FullName))
        {
            claims.Add(new Claim(ClaimTypes.Name, user.FullName));
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
