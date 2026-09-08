namespace DigitalDive.Hr.Api.Models;

public sealed class LegalEntityCreateRequest
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? TradeLicence { get; set; }
    public string? MohreEstablishmentNo { get; set; }
    public string? WpsEmployerId { get; set; }
    public string? Emirate { get; set; }
    public string? FreeZoneAuthority { get; set; }
    public string? JurisdictionProfile { get; set; }
    public string? BankName { get; set; }
}

public sealed class BranchCreateRequest
{
    public int LegalEntityId { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Emirate { get; set; }
    public bool IsRemote { get; set; }
}

public sealed class PositionCreateRequest
{
    public string Code { get; set; } = "";
    public int LegalEntityId { get; set; }
    public int? BranchId { get; set; }
    public int? DepartmentId { get; set; }
    public int? DivisionId { get; set; }
    public int? DesignationId { get; set; }
    public string Title { get; set; } = "";
    public int? ReportsToPositionId { get; set; }
    public decimal? BudgetMin { get; set; }
    public decimal? BudgetMax { get; set; }
    public string? Status { get; set; }
    public string? EffectiveFrom { get; set; }
}

public sealed class PositionUpdateRequest
{
    public string? Title { get; set; }
    public int? BranchId { get; set; }
    public int? DepartmentId { get; set; }
    public int? DivisionId { get; set; }
    public int? DesignationId { get; set; }
    public int? ReportsToPositionId { get; set; }
    public decimal? BudgetMin { get; set; }
    public decimal? BudgetMax { get; set; }
    public string? Status { get; set; }
    public string? EffectiveTo { get; set; }
}

public sealed class AssignmentCreateRequest
{
    public int PositionId { get; set; }
    public int EmployeeId { get; set; }
    public string? AssignmentType { get; set; }
    public bool IsPrimary { get; set; } = true;
    public string? EffectiveFrom { get; set; }
    public int? TemporaryManagerEmployeeId { get; set; }
    public string? Notes { get; set; }
}
