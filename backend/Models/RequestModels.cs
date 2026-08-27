namespace DigitalDive.Hr.Api.Models;

public sealed class StatusUpdateRequest
{
    public string Status { get; set; } = string.Empty;
}

public sealed class AttendanceCreateRequest
{
    public int EmployeeId { get; set; }
    public string WorkDate { get; set; } = string.Empty;
    public string? CheckIn { get; set; }
    public string? CheckOut { get; set; }
    public string? Status { get; set; }
    public decimal OvertimeHours { get; set; }
}

public sealed class LeaveCreateRequest
{
    public int EmployeeId { get; set; }
    public string LeaveType { get; set; } = string.Empty;
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public decimal Days { get; set; }
    public string? Reason { get; set; }
}

public sealed class EssProfileUpdateRequest
{
    public string? Phone { get; set; }
}
