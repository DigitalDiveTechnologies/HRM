using System.Security.Claims;

namespace DigitalDive.Hr.Api.Helpers;

public static class CurrentUser
{
    public static string Role(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.Role)
        ?? user.FindFirstValue("role")
        ?? "employee";

    public static int? EmployeeId(ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue("employee_id");
        return int.TryParse(raw, out var id) ? id : null;
    }

    public static bool IsAdmin(ClaimsPrincipal user) =>
        string.Equals(Role(user), "admin", StringComparison.OrdinalIgnoreCase);

    public static bool IsManager(ClaimsPrincipal user) =>
        string.Equals(Role(user), "manager", StringComparison.OrdinalIgnoreCase);

    public static bool IsEmployee(ClaimsPrincipal user) =>
        string.Equals(Role(user), "employee", StringComparison.OrdinalIgnoreCase);
}
