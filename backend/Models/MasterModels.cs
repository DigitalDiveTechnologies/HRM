namespace DigitalDive.Hr.Api.Models;

public sealed class CreateMasterRequest
{
    public string Name { get; set; } = string.Empty;
}

public sealed class CreateDesignationRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? JobFamily { get; set; }
    public string? Grade { get; set; }
    public string? SkillLevel { get; set; }
    public int? DefaultReportingDesignationId { get; set; }
}

public sealed class UpdateMasterRequest
{
    public string? Name { get; set; }
    public string? Status { get; set; }
    public string? Code { get; set; }
    public string? JobFamily { get; set; }
    public string? Grade { get; set; }
    public string? SkillLevel { get; set; }
    public int? DefaultReportingDesignationId { get; set; }
}

public sealed class UpdateEmployeeRequest
{
    public string? FirstName { get; set; }
    public string? MiddleName { get; set; }
    public string? LastName { get; set; }
    public string? JobTitle { get; set; }
    public string? Phone { get; set; }
    public int? DepartmentId { get; set; }
    public int? DivisionId { get; set; }
    public int? DesignationId { get; set; }
    public int? EmploymentTypeId { get; set; }
    public int? ManagerId { get; set; }
    public string? JoinDate { get; set; }
    public string? Status { get; set; }
    public bool? PhotoRemoved { get; set; }
    public string? PhotoPath { get; set; }
    public Dictionary<string, object?>? MasterData { get; set; }
    /// <summary>Optional vacant/other position to assign as primary (Phase 1). Additive.</summary>
    public int? PositionId { get; set; }
}

public sealed class BulkImportResult
{
    public int Created { get; set; }
    public int Failed { get; set; }
    public List<string> Errors { get; set; } = [];
}
