namespace DigitalDive.Hr.Api.Models;

public sealed class CreateDivisionRequest
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? PayrollType { get; set; }
}

public sealed class UpdateDivisionRequest
{
    public string? Name { get; set; }
    public string? PayrollType { get; set; }
    public string? Status { get; set; }
}
