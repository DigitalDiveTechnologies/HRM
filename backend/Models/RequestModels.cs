namespace DigitalDive.Hr.Api.Models;

public sealed class StatusUpdateRequest
{
    public string Status { get; set; } = string.Empty;
}

public sealed class ApprovalDecisionRequest
{
    public string Status { get; set; } = string.Empty;
    public string? Note { get; set; }
}

public sealed class AttendanceCreateRequest
{
    public int EmployeeId { get; set; }
    public string WorkDate { get; set; } = string.Empty;
    public string? CheckIn { get; set; }
    public string? CheckOut { get; set; }
    public string? Status { get; set; }
    public string? ShiftName { get; set; }
    public decimal OvertimeHours { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? CheckInLatitude { get; set; }
    public double? CheckInLongitude { get; set; }
    public double? CheckOutLatitude { get; set; }
    public double? CheckOutLongitude { get; set; }
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

public sealed class CandidateOfferRequest
{
    public int? JobId { get; set; }
    public string JobTitle { get; set; } = string.Empty;
    public string Designation { get => JobTitle; set => JobTitle = value; }
    public decimal BasicSalary { get; set; }
    public decimal OfferedBasicSalary { get => BasicSalary; set => BasicSalary = value; }
    public decimal HousingAllowance { get; set; }
    public decimal OfferedHousingAllowance { get => HousingAllowance; set => HousingAllowance = value; }
    public decimal TransportAllowance { get; set; }
    public decimal OfferedTransportAllowance { get => TransportAllowance; set => TransportAllowance = value; }
    public decimal? OtherAllowance { get; set; }
    public string? BenefitsSummary { get; set; }
    public string? JoinDate { get; set; }
    public string JoiningDate { get => JoinDate ?? string.Empty; set => JoinDate = value; }
    public string? ReportingTo { get; set; }
    public string WorkplaceLocation { get; set; } = "Abu Dhabi, UAE";
    public string? ProbationPeriod { get; set; }
    public int ProbationPeriodMonths { get; set; } = 6;
    public string? ValidityDate { get; set; }
    public string ContractType { get; set; } = "limited";
    public string Status { get; set; } = "issued";
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
    public int? ParentGoalId { get; set; }
    public decimal? Weightage { get; set; }
    public string? TargetMetric { get; set; }
    public string? CurrentMetric { get; set; }
    public string? DueDate { get; set; }
    public string? FileRef { get; set; }
}

public sealed class PerformanceGoalUpdateRequest
{
    public decimal? ProgressPct { get; set; }
    public string? Status { get; set; }
    public decimal? Weightage { get; set; }
    public string? TargetMetric { get; set; }
    public string? CurrentMetric { get; set; }
    public string? DueDate { get; set; }
    public string? FileRef { get; set; }
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
    public int? TemplateId { get; set; }
    public object? AnswersJson { get; set; }
    public decimal? PotentialRating { get; set; }
    public string? FileRef { get; set; }
    public string? EmployeeType { get; set; }
}

public sealed class PerformanceTemplateCreateRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ReviewType { get; set; } = "annual";
    public object? SectionsJson { get; set; }
    public bool IsActive { get; set; } = true;
    public string? TargetEmployeeType { get; set; } = "all";
}

public sealed class PerformancePeerNominationRequest
{
    public int ReviewId { get; set; }
    public int NomineeId { get; set; }
    public int ReviewerId { get; set; }
    public bool IsAnonymous { get; set; } = true;
}

public sealed class PerformancePeerFeedbackSubmitRequest
{
    public object? FeedbackJson { get; set; }
}

public sealed class PerformanceReminderRequest
{
    public int? EmployeeId { get; set; }
    public int? ReviewId { get; set; }
    public string? ReviewType { get; set; }
    public string? DueDate { get; set; }
    public string? Stage { get; set; }
}

public sealed class ApprovalRoutingRuleRequest
{
    public int? Id { get; set; }
    public string RequestType { get; set; } = string.Empty;
    public int? DepartmentId { get; set; }
    public decimal MinThreshold { get; set; }
    public decimal? MaxThreshold { get; set; }
    public int LevelsCount { get; set; } = 1;
    public string ApproverRole { get; set; } = "manager";
    public bool IsActive { get; set; } = true;
}

public sealed class CustomFieldSchemaRequest
{
    public string FieldKey { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string? DataType { get; set; } = "text";
    public bool Required { get; set; }
    public string? Category { get; set; }
    public object? Options { get; set; }
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
    public string? ReceiptFileRef { get; set; }
    public string? ReceiptFileName { get; set; }
}

public sealed class DocumentCreateRequest
{
    public int EmployeeId { get; set; }
    public string DocType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? FileRef { get; set; }
    public string? IssueDate { get; set; }
    public string? ExpiryDate { get; set; }
    public string? Status { get; set; }
}

public sealed class PayrollRunRequest
{
    public string PeriodLabel { get; set; } = string.Empty;
    public decimal OtRatePerHour { get; set; } = 50m;
}

public sealed class EmploymentHistoryCreateRequest
{
    public int EmployeeId { get; set; }
    public string JobTitle { get; set; } = string.Empty;
    public string? DepartmentName { get; set; }
    public string? ManagerName { get; set; }
    public string StartDate { get; set; } = string.Empty;
    public string? EndDate { get; set; }
    public string? Notes { get; set; }
}

public sealed class EmployeeSkillAssignRequest
{
    public int EmployeeId { get; set; }
    public int SkillId { get; set; }
    public string? Level { get; set; }
}

public sealed class AuditLogCreateRequest
{
    public string Action { get; set; } = string.Empty;
    public string? EntityType { get; set; }
    public int? EntityId { get; set; }
    public string? Detail { get; set; }
}

public sealed class CertificateCreateRequest
{
    public int EmployeeId { get; set; }
    public string CertificateType { get; set; } = string.Empty;
    public string? Purpose { get; set; }
    public string? BankName { get; set; }
    public string? TravelDestination { get; set; }
}

public sealed class CertificateDecisionRequest
{
    public string Status { get; set; } = string.Empty;
    public string? HrNote { get; set; }
}

public sealed class BenefitPlanCreateRequest
{
    public string Name { get; set; } = string.Empty;
    public string? BenefitType { get; set; } = "medical_insurance";
    public string ProviderName { get; set; } = string.Empty;
    public string PolicyNumber { get; set; } = string.Empty;
    public string? CoverageSummary { get; set; }
    public decimal AnnualPremiumEmployer { get; set; } = 0m;
    public decimal AnnualPremiumEmployee { get; set; } = 0m;
    public bool IsActive { get; set; } = true;
}

public sealed class BenefitAssignRequest
{
    public int EmployeeId { get; set; }
    public int BenefitPlanId { get; set; }
    public string? MemberId { get; set; }
    public string? CoverageTier { get; set; } = "employee_only";
    public int DependentsCount { get; set; } = 0;
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public string? Status { get; set; } = "active";
}
