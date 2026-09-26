using System.Security.Claims;
using DigitalDive.Hr.Api.Services;

namespace DigitalDive.Hr.Api.Helpers;

/// <summary>
/// RBAC gate: admin/super_admin always pass; other roles need at least one of the codes.
/// Use this instead of [Authorize(Roles="admin")] for feature APIs.
/// </summary>
public static class PermissionGate
{
    public static async Task<bool> HasAsync(
        RbacService rbac,
        ClaimsPrincipal user,
        CancellationToken ct,
        params string[] codes)
    {
        var role = CurrentUser.Role(user);
        if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase))
            return true;

        if (codes is null || codes.Length == 0)
            return false;

        var perms = await rbac.GetPermissionCodesForRoleAsync(role, ct);
        foreach (var code in codes)
        {
            if (string.IsNullOrWhiteSpace(code)) continue;
            if (perms.Any(p => string.Equals(p, code, StringComparison.OrdinalIgnoreCase)))
                return true;
        }

        return false;
    }
}
