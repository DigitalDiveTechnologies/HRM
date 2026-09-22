using System.Security.Claims;

namespace DigitalDive.Hr.Api.Helpers;

public static class CurrentUser
{
    private static readonly string[] RolePreference =
    {
        "super_admin", "admin", "manager", "hr_officer", "finance", "viewer", "employee"
    };

    public static string Role(ClaimsPrincipal user)
    {
        var roles = user.FindAll("role").Select(c => c.Value)
            .Concat(user.FindAll(ClaimTypes.Role).Select(c => c.Value))
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .ToList();
        if (roles.Count == 0) return "employee";
        foreach (var preferred in RolePreference)
        {
            var hit = roles.FirstOrDefault(r => string.Equals(r, preferred, StringComparison.OrdinalIgnoreCase));
            if (hit is not null) return hit;
        }
        return roles[0];
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
        user.IsInRole("admin")
        || user.IsInRole("super_admin")
        || string.Equals(Role(user), "admin", StringComparison.OrdinalIgnoreCase)
        || string.Equals(Role(user), "super_admin", StringComparison.OrdinalIgnoreCase);

    public static bool IsManager(ClaimsPrincipal user) =>
        string.Equals(Role(user), "manager", StringComparison.OrdinalIgnoreCase);

    public static bool IsEmployee(ClaimsPrincipal user) =>
        string.Equals(Role(user), "employee", StringComparison.OrdinalIgnoreCase);
}
