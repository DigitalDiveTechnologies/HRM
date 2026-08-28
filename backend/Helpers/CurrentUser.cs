using System.Security.Claims;

namespace DigitalDive.Hr.Api.Helpers;

public static class CurrentUser
{
    public static string Role(ClaimsPrincipal user) =>
        user.FindFirstValue("role")
        ?? user.FindFirstValue(ClaimTypes.Role)
        ?? "employee";

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
        string.Equals(Role(user), "admin", StringComparison.OrdinalIgnoreCase);

    public static bool IsManager(ClaimsPrincipal user) =>
        string.Equals(Role(user), "manager", StringComparison.OrdinalIgnoreCase);

    public static bool IsEmployee(ClaimsPrincipal user) =>
        string.Equals(Role(user), "employee", StringComparison.OrdinalIgnoreCase);
}
