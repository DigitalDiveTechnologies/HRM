namespace DigitalDive.Hr.Api.Models;

public sealed class RoleDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Portal { get; set; } = string.Empty;
    public bool IsSystem { get; set; }
}

public sealed class RbacUserDto
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string Role { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public string Portal { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public int? EmployeeId { get; set; }
}

public sealed class CreateRbacUserRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string RoleCode { get; set; } = string.Empty;
}

public sealed class UpdateRbacUserRequest
{
    public string? DisplayName { get; set; }
    public string? RoleCode { get; set; }
    public bool? IsActive { get; set; }
    public string? Password { get; set; }
}
