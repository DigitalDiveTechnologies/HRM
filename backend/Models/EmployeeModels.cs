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
