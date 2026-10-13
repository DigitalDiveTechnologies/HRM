using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Ess")]
[Route("api/ess")]
[Authorize(Roles = "admin,manager,employee")]
public sealed class EssController : ControllerBase
{
    private readonly HrQueryService _hr;

    public EssController(HrQueryService hr) => _hr = hr;

    [HttpGet("{employeeId:int}")]
    public async Task<IActionResult> Get(int employeeId, CancellationToken ct)
    {
        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null || self.Value != employeeId) return Forbid();
        }

        return Ok(await _hr.EssAsync(employeeId, ct));
    }

    [HttpGet("{employeeId:int}/payslips/{payslipId:int}/pdf")]
    public async Task<IActionResult> PayslipPdf(int employeeId, int payslipId, CancellationToken ct)
    {
        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null || self.Value != employeeId) return Forbid();
        }
        var slip = await _hr.PayslipForEmployeeAsync(employeeId, payslipId, ct);
        if (slip is null) return NotFound(new { error = "Payslip not found." });
        static string S(Dictionary<string, object?> row, string key) => Convert.ToString(row.GetValueOrDefault(key)) ?? "—";
        var lines = new[] {
            "OFFICIAL SALARY STATEMENT", "", $"Company: {S(slip, "division_name")}", $"Period: {S(slip, "period_label")}",
            $"Employee: {S(slip, "full_name")} ({S(slip, "emp_code")})", $"Job title: {S(slip, "job_title")}", $"Department: {S(slip, "department_name")}", "",
            $"Basic salary: AED {S(slip, "basic_salary")}", $"Allowances: AED {S(slip, "allowances")}", $"Overtime: AED {S(slip, "overtime_pay")}",
            $"Deductions: AED {S(slip, "deductions")}", $"Net pay: AED {S(slip, "net_pay")}", $"Payment reference: {S(slip, "wps_ref")}",
        };
        var pdf = BuildSimplePdf(lines);
        return File(pdf, "application/pdf", $"Payslip-{S(slip, "period_label")}-{S(slip, "emp_code")}.pdf");
    }

    private static byte[] BuildSimplePdf(IEnumerable<string> lines)
    {
        var content = new StringBuilder("BT /F1 12 Tf 50 780 Td 0 -18 Td\n");
        foreach (var line in lines) content.Append('(').Append(line.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)" )).Append(") Tj 0 -18 Td\n");
        content.Append("ET");
        var objects = new[] {
            "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", $"<< /Length {Encoding.ASCII.GetByteCount(content.ToString())} >>\nstream\n{content}\nendstream"
        };
        var output = new StringBuilder("%PDF-1.4\n"); var offsets = new List<int> { 0 };
        foreach (var (obj, i) in objects.Select((x, i) => (x, i + 1))) { offsets.Add(Encoding.ASCII.GetByteCount(output.ToString())); output.Append($"{i} 0 obj\n{obj}\nendobj\n"); }
        var xref = Encoding.ASCII.GetByteCount(output.ToString()); output.Append($"xref\n0 {objects.Length + 1}\n0000000000 65535 f \n");
        for (var i = 1; i < offsets.Count; i++) output.Append($"{offsets[i]:D10} 00000 n \n");
        output.Append($"trailer\n<< /Size {objects.Length + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF");
        return Encoding.ASCII.GetBytes(output.ToString());
    }

    [HttpPatch("{employeeId:int}/profile")]
    public async Task<IActionResult> UpdateProfile(int employeeId, [FromBody] EssProfileUpdateRequest body, CancellationToken ct)
    {
        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null || self.Value != employeeId) return Forbid();
        }

        var row = await _hr.UpdateEssPhoneAsync(employeeId, body.Phone, ct);
        return row is null ? NotFound() : Ok(row);
    }
}
