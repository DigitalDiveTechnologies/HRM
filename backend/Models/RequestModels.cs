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

public sealed class JobPostingCreateRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Department { get; set; }
    public string? Location { get; set; }
    public string? EmploymentType { get; set; }
    public string? Description { get; set; }
    public string? Status { get; set; }
}

public sealed class CandidateCreateRequest
{
    public int? JobId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? ResumeRef { get; set; }
    public string? Source { get; set; }
    public string? Stage { get; set; }
    public string? Notes { get; set; }
}

public sealed class CandidateStageUpdateRequest
{
    public string Stage { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

public sealed class InterviewCreateRequest
{
    public int CandidateId { get; set; }
    public string ScheduledAt { get; set; } = string.Empty;
    public string? Interviewer { get; set; }
    public string? Mode { get; set; }
}

public sealed class OfferCreateRequest
{
    public int CandidateId { get; set; }
    public decimal Salary { get; set; }
    public string? Currency { get; set; }
    public string? JoinDate { get; set; }
    public string? Status { get; set; }
    public string? LetterRef { get; set; }
}

public sealed class ExitCaseCreateRequest
{
    public int EmployeeId { get; set; }
    public string? ExitType { get; set; }
    public string? Reason { get; set; }
    public string? NoticeDate { get; set; }
    public string? LastWorkingDate { get; set; }
    public string? SettlementNotes { get; set; }
}

public sealed class ExitChecklistUpdateRequest
{
    public string Status { get; set; } = string.Empty;
}

public sealed class ComplianceItemCreateRequest
{
    public int EmployeeId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Category { get; set; }
    public string? DueDate { get; set; }
    public string? Status { get; set; }
    public string? Notes { get; set; }
}

public sealed class PerformanceGoalCreateRequest
{
    public int EmployeeId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Kpi { get; set; }
    public string? TargetValue { get; set; }
    public decimal ProgressPct { get; set; }
    public string? PeriodLabel { get; set; }
    public string? Status { get; set; }
}

public sealed class PerformanceGoalUpdateRequest
{
    public decimal? ProgressPct { get; set; }
    public string? Status { get; set; }
}

public sealed class PerformanceReviewCreateRequest
{
    public int EmployeeId { get; set; }
    public string? ReviewerName { get; set; }
    public string? ReviewType { get; set; }
    public decimal? Rating { get; set; }
    public string? Summary { get; set; }
    public string? Status { get; set; }
    public string? ReviewDate { get; set; }
}

public sealed class CourseCreateRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Category { get; set; }
    public decimal DurationHours { get; set; }
    public string? Description { get; set; }
    public string? Status { get; set; }
}

public sealed class EnrollmentCreateRequest
{
    public int CourseId { get; set; }
    public int EmployeeId { get; set; }
    public string? DueDate { get; set; }
    public string? Status { get; set; }
}

public sealed class CertificationCreateRequest
{
    public int EmployeeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Issuer { get; set; }
    public string? IssuedOn { get; set; }
    public string? ExpiresOn { get; set; }
    public string? Status { get; set; }
}

public sealed class AssetCreateRequest
{
    public string AssetTag { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Category { get; set; }
    public string? SerialNo { get; set; }
    public string? Status { get; set; }
}

public sealed class AssetAssignRequest
{
    public int EmployeeId { get; set; }
    public string? Notes { get; set; }
}

public sealed class TravelRequestCreateRequest
{
    public int EmployeeId { get; set; }
    public string Destination { get; set; } = string.Empty;
    public string? Purpose { get; set; }
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public decimal EstimatedCost { get; set; }
    public string? Currency { get; set; }
}

public sealed class ExpenseClaimCreateRequest
{
    public int EmployeeId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Category { get; set; }
    public decimal Amount { get; set; }
    public string? Currency { get; set; }
    public string? ExpenseDate { get; set; }
    public string? Notes { get; set; }
}
