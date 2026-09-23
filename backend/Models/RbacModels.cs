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

public sealed class PermissionDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string GroupCode { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public string? ParentCode { get; set; }
    public string? Path { get; set; }
    public int SortOrder { get; set; }
}

public sealed class PermissionMatrixDto
{
    public IReadOnlyList<RoleDto> Roles { get; set; } = Array.Empty<RoleDto>();
    public IReadOnlyList<PermissionDto> Permissions { get; set; } = Array.Empty<PermissionDto>();
    /// <summary>roleCode → permission codes granted</summary>
    public Dictionary<string, List<string>> Grants { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public sealed class SavePermissionMatrixRequest
{
    /// <summary>roleCode → permission codes to grant (replaces existing grants for that role)</summary>
    public Dictionary<string, List<string>> Grants { get; set; } = new(StringComparer.OrdinalIgnoreCase);
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

public sealed class CreateRoleRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Description { get; set; }
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
    public string? Email { get; set; }
    public string? DisplayName { get; set; }
    public string? RoleCode { get; set; }
    public bool? IsActive { get; set; }
    public string? Password { get; set; }
}
