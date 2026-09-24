using System.Security.Claims;

namespace DigitalDive.Hr.Api.Helpers;

public static class CurrentUser
{
    /// <summary>
    /// Prefer real app roles over the synthetic JWT "admin" companion claim
    /// (added so finance / hr_officer / custom roles pass [Authorize(Roles="admin")]).
    /// </summary>
    private static readonly string[] RolePreference =
    {
        "super_admin", "hr_officer", "finance", "viewer", "manager", "employee", "admin"
    };

    public static string Role(ClaimsPrincipal user)
    {
        // Dedicated claim wins (never the synthetic admin companion)
        var appRole = user.FindFirstValue("app_role");
        if (!string.IsNullOrWhiteSpace(appRole))
            return appRole.Trim();

        var roles = user.FindAll("role").Select(c => c.Value)
            .Concat(user.FindAll(ClaimTypes.Role).Select(c => c.Value))
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Select(r => r.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (roles.Count == 0) return "employee";

        foreach (var preferred in RolePreference)
        {
            var hit = roles.FirstOrDefault(r => string.Equals(r, preferred, StringComparison.OrdinalIgnoreCase));
            if (hit is not null) return hit;
        }

        // Custom role + synthetic admin → keep the custom code, not "admin"
        var nonAdmin = roles.FirstOrDefault(r => !string.Equals(r, "admin", StringComparison.OrdinalIgnoreCase));
        return nonAdmin ?? roles[0];
    }

    public static string? Email(ClaimsPrincipal user) =>
        user.FindFirstValue("email")
        ?? user.FindFirstValue(ClaimTypes.Email);

    public static string? Name(ClaimsPrincipal user) =>
        user.FindFirstValue("name")
        ?? user.FindFirstValue(ClaimTypes.Name)
        ?? user.FindFirstValue("unique_name");

    public static string? UserId(ClaimsPrincipal user) =>
        user.FindFirstValue("sub")
        ?? user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? user.FindFirstValue("nameid");

    public static int? EmployeeId(ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue("employee_id");
        return int.TryParse(raw, out var id) ? id : null;
    }

    public static bool IsAdmin(ClaimsPrincipal user) =>
        string.Equals(Role(user), "admin", StringComparison.OrdinalIgnoreCase)
        || string.Equals(Role(user), "super_admin", StringComparison.OrdinalIgnoreCase);

    public static bool IsManager(ClaimsPrincipal user) =>
        string.Equals(Role(user), "manager", StringComparison.OrdinalIgnoreCase);

    public static bool IsEmployee(ClaimsPrincipal user) =>
        string.Equals(Role(user), "employee", StringComparison.OrdinalIgnoreCase);
}
