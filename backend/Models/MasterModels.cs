namespace DigitalDive.Hr.Api.Models;

public sealed class CreateMasterRequest
{
    public string Name { get; set; } = string.Empty;
}

public sealed class UpdateMasterRequest
{
    public string? Name { get; set; }
    public string? Status { get; set; }
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
    public Dictionary<string, object?>? MasterData { get; set; }
}

public sealed class BulkImportResult
{
    public int Created { get; set; }
    public int Failed { get; set; }
    public List<string> Errors { get; set; } = [];
}
