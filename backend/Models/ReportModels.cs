namespace DigitalDive.Hr.Api.Models;

public sealed class CustomReportRequest
{
    public List<string> Columns { get; set; } = new();
    public CustomReportFilters? Filters { get; set; }
    public string? Format { get; set; } = "csv";
}

public sealed class CustomReportFilters
{
    public int? DepartmentId { get; set; }
    public int? DivisionId { get; set; }
    public string? Status { get; set; }
    public string? JoinDateStart { get; set; }
    public string? JoinDateEnd { get; set; }
    public string? Search { get; set; }
}
