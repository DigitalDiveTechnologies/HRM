namespace DigitalDive.Hr.Api.Models;

public sealed class EmployeeDto
{
    public int Id { get; set; }
    public string EmpCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? DepartmentName { get; set; }
    public string? JobTitle { get; set; }
    public string? Status { get; set; }
    public DateTime? PassportExpiry { get; set; }
    public DateTime? VisaExpiry { get; set; }
}

public sealed class CreateEmployeeRequest
{
    public string FullName { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? MiddleName { get; set; }
    public string? LastName { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string JobTitle { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public int? DepartmentId { get; set; }
    public int? DivisionId { get; set; }
    public int? DesignationId { get; set; }
    public int? EmploymentTypeId { get; set; }
    public int? ManagerId { get; set; }
    public string? JoinDate { get; set; }
    public string? Status { get; set; }
    public Dictionary<string, object?>? MasterData { get; set; }
}

public sealed class ResetEmployeePasswordRequest
{
    public string Password { get; set; } = string.Empty;
}
