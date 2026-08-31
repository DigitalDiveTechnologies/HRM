using ClosedXML.Excel;
using DigitalDive.Hr.Api.Models;

namespace DigitalDive.Hr.Api.Services;

public sealed class EmployeeBulkService
{
    private static readonly string[] Headers =
    [
        "Full Name",
        "Email",
        "Designation",
        "Employment Type",
        "Division Code",
        "Department",
        "Phone",
        "Join Date",
        "Manager Email",
        "App Password",
        "Status",
    ];

    private readonly HrQueryService _hr;

    public EmployeeBulkService(HrQueryService hr) => _hr = hr;

    public byte[] BuildTemplate()
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Employees");
        for (var i = 0; i < Headers.Length; i++)
        {
            ws.Cell(1, i + 1).Value = Headers[i];
            ws.Cell(1, i + 1).Style.Font.Bold = true;
        }

        ws.Cell(2, 1).Value = "Ahmed Example";
        ws.Cell(2, 2).Value = "ahmed.example@gocsglobal.com";
        ws.Cell(2, 3).Value = "Software Engineer";
        ws.Cell(2, 4).Value = "Full-time";
        ws.Cell(2, 5).Value = "ALKIDMA";
        ws.Cell(2, 6).Value = "Engineering";
        ws.Cell(2, 7).Value = "+971500000000";
        ws.Cell(2, 8).Value = DateTime.UtcNow.ToString("yyyy-MM-dd");
        ws.Cell(2, 9).Value = "";
        ws.Cell(2, 10).Value = "demo123";
        ws.Cell(2, 11).Value = "active";

        ws.Columns().AdjustToContents();
        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    public async Task<BulkImportResult> ImportAsync(Stream fileStream, CancellationToken ct)
    {
        var result = new BulkImportResult();
        using var wb = new XLWorkbook(fileStream);
        var ws = wb.Worksheet(1);
        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;

        for (var row = 2; row <= lastRow; row++)
        {
            var fullName = CellText(ws, row, 1);
            var email = CellText(ws, row, 2);
            if (string.IsNullOrWhiteSpace(fullName) && string.IsNullOrWhiteSpace(email))
            {
                continue;
            }

            var designationName = CellText(ws, row, 3);
            var employmentTypeName = CellText(ws, row, 4);
            var divisionCode = CellText(ws, row, 5);
            var departmentName = CellText(ws, row, 6);
            var phone = CellText(ws, row, 7);
            var joinDate = CellText(ws, row, 8);
            var managerEmail = CellText(ws, row, 9);
            var password = CellText(ws, row, 10);
            var status = CellText(ws, row, 11);

            if (string.IsNullOrWhiteSpace(password))
            {
                password = "demo123";
            }

            var (designationId, desigErr) = await _hr.ResolveDesignationIdAsync(designationName, ct);
            if (desigErr is not null)
            {
                result.Failed++;
                result.Errors.Add($"Row {row}: {desigErr}");
                continue;
            }

            var (employmentTypeId, empTypeErr) = await _hr.ResolveEmploymentTypeIdAsync(employmentTypeName, ct);
            if (empTypeErr is not null)
            {
                result.Failed++;
                result.Errors.Add($"Row {row}: {empTypeErr}");
                continue;
            }

            var (divisionId, divErr) = await _hr.ResolveDivisionIdByCodeAsync(divisionCode, ct);
            if (divErr is not null)
            {
                result.Failed++;
                result.Errors.Add($"Row {row}: {divErr}");
                continue;
            }

            var (departmentId, deptErr) = await _hr.ResolveDepartmentIdByNameAsync(departmentName, ct);
            if (deptErr is not null)
            {
                result.Failed++;
                result.Errors.Add($"Row {row}: {deptErr}");
                continue;
            }

            var (managerId, mgrErr) = await _hr.ResolveManagerIdByEmailAsync(managerEmail, ct);
            if (mgrErr is not null)
            {
                result.Failed++;
                result.Errors.Add($"Row {row}: {mgrErr}");
                continue;
            }

            var jobTitle = string.IsNullOrWhiteSpace(designationName) ? "Employee" : designationName.Trim();
            var (employee, error) = await _hr.CreateEmployeeWithLoginAsync(
                fullName,
                email,
                password,
                jobTitle,
                phone,
                departmentId,
                divisionId,
                designationId,
                employmentTypeId,
                managerId,
                joinDate,
                string.IsNullOrWhiteSpace(status) ? "active" : status,
                ct);

            if (error is not null)
            {
                result.Failed++;
                result.Errors.Add($"Row {row} ({email}): {error}");
                continue;
            }

            result.Created++;
            _ = employee;
        }

        return result;
    }

    private static string CellText(IXLWorksheet ws, int row, int col)
    {
        var v = ws.Cell(row, col).GetFormattedString();
        return string.IsNullOrWhiteSpace(v) ? string.Empty : v.Trim();
    }
}
