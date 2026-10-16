using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Globalization;
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
        static string S(Dictionary<string, object?> row, string key) => Convert.ToString(row.GetValueOrDefault(key), CultureInfo.InvariantCulture) ?? "-";
        var pdf = BuildPayslipPdf(slip);
        return File(pdf, "application/pdf", $"Payslip-{S(slip, "period_label")}-{S(slip, "emp_code")}.pdf");
    }

    [HttpGet("{employeeId:int}/payslips/latest/pdf")]
    public Task<IActionResult> LatestPayslipPdf(int employeeId, CancellationToken ct) => PayslipPdf(employeeId, 0, ct);

    private static byte[] BuildPayslipPdf(Dictionary<string, object?> slip)
    {
        static string Text(Dictionary<string, object?> row, string key) => Convert.ToString(row.GetValueOrDefault(key), CultureInfo.InvariantCulture)?.Trim() is { Length: > 0 } value ? value : "-";
        static decimal Amount(Dictionary<string, object?> row, string key)
        {
            var value = row.GetValueOrDefault(key);
            if (value is decimal dec) return dec;
            return decimal.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0m;
        }
        static string Money(decimal value) => $"AED {value.ToString("N2", CultureInfo.InvariantCulture)}";
        static string PdfText(string value) => value.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)").Replace("\r", " ").Replace("\n", " ");
        static string Clip(string value, int max) => value.Length <= max ? value : value[..Math.Max(0, max - 3)] + "...";

        var company = Text(slip, "division_name");
        var period = Text(slip, "period_label");
        var employee = Text(slip, "full_name");
        var empCode = Text(slip, "emp_code");
        var jobTitle = Text(slip, "job_title");
        var department = Text(slip, "department_name");
        var paymentMethod = Text(slip, "payment_method").Replace("_", " ").ToUpperInvariant();
        var reference = Text(slip, "wps_ref");
        var basic = Amount(slip, "basic_salary");
        var allowances = Amount(slip, "allowances");
        var overtime = Amount(slip, "overtime_pay");
        var deductions = Amount(slip, "deductions");
        var gross = basic + allowances + overtime;
        var net = Amount(slip, "net_pay");
        var content = new StringBuilder();
        void Fill(double r, double g, double b) => content.AppendFormat(CultureInfo.InvariantCulture, "{0:0.###} {1:0.###} {2:0.###} rg\n", r, g, b);
        void Stroke(double r, double g, double b) => content.AppendFormat(CultureInfo.InvariantCulture, "{0:0.###} {1:0.###} {2:0.###} RG\n", r, g, b);
        void Rect(double x, double y, double w, double h, bool fill = true) => content.AppendFormat(CultureInfo.InvariantCulture, "{0:0.##} {1:0.##} {2:0.##} {3:0.##} re {4}\n", x, y, w, h, fill ? "f" : "S");
        void Line(double x1, double y1, double x2, double y2) => content.AppendFormat(CultureInfo.InvariantCulture, "{0:0.##} {1:0.##} m {2:0.##} {3:0.##} l S\n", x1, y1, x2, y2);
        void TextAt(string value, double x, double y, double size, string font = "/F1", double r = 0.08, double g = 0.12, double b = 0.18)
        {
            Fill(r, g, b);
            content.AppendFormat(CultureInfo.InvariantCulture, "BT {0} {1:0.##} Tf 1 0 0 1 {2:0.##} {3:0.##} Tm ({4}) Tj ET\n", font, size, x, y, PdfText(value));
        }
        void RightText(string value, double right, double y, double size, string font = "/F1", double r = 0.08, double g = 0.12, double b = 0.18)
        {
            // Helvetica metrics are approximated closely enough for right-aligned currency values.
            TextAt(value, right - (value.Length * size * 0.52), y, size, font, r, g, b);
        }
        void LabelValue(string label, string value, double x, double y, double width)
        {
            TextAt(label.ToUpperInvariant(), x, y + 18, 7, "/F2", 0.35, 0.42, 0.50);
            TextAt(Clip(value, 42), x, y, 10, "/F2");
        }

        // Header
        Fill(0.05, 0.22, 0.34); Rect(0, 690, 612, 102);
        TextAt("SALARY SLIP", 42, 748, 23, "/F2", 1, 1, 1);
        TextAt(Clip(company, 55), 42, 724, 12, "/F2", 0.85, 0.96, 1);
        TextAt("CONFIDENTIAL", 466, 750, 8, "/F2", 0.72, 0.86, 0.92);
        TextAt("Official employee salary statement", 42, 706, 8, "/F1", 0.72, 0.86, 0.92);

        // Employee and statement details
        Fill(0.96, 0.98, 0.99); Rect(42, 588, 528, 78);
        Stroke(0.85, 0.89, 0.92); Rect(42, 588, 528, 78, false);
        LabelValue("Employee", employee, 58, 633, 220);
        LabelValue("Employee code", empCode, 310, 633, 100);
        LabelValue("Pay period", period, 448, 633, 100);
        LabelValue("Job title", jobTitle, 58, 603, 220);
        LabelValue("Department", department, 310, 603, 180);
        LabelValue("Payslip ID", Text(slip, "id"), 448, 603, 100);

        // Earnings
        TextAt("EARNINGS", 42, 558, 10, "/F2", 0.05, 0.22, 0.34);
        Fill(0.05, 0.22, 0.34); Rect(42, 528, 528, 22);
        TextAt("Description", 56, 536, 8, "/F2", 1, 1, 1);
        RightText("Amount", 554, 536, 8, "/F2", 1, 1, 1);
        var rows = new[] { ("Basic salary", basic), ("Allowances", allowances), ("Overtime", overtime), ("Gross earnings", gross) };
        var rowY = 503;
        foreach (var row in rows)
        {
            Fill(rowY == 428 ? 0.90 : 0.98, rowY == 428 ? 0.96 : 0.99, rowY == 428 ? 0.98 : 1); Rect(42, rowY - 5, 528, 25);
            Stroke(0.88, 0.91, 0.93); Line(42, rowY - 5, 570, rowY - 5);
            TextAt(row.Item1, 56, rowY + 4, 9, row.Item1 == "Gross earnings" ? "/F2" : "/F1");
            RightText(Money(row.Item2), 554, rowY + 4, 9, row.Item1 == "Gross earnings" ? "/F2" : "/F1");
            rowY -= 25;
        }

        // Deductions and net pay
        TextAt("DEDUCTIONS", 42, 393, 10, "/F2", 0.05, 0.22, 0.34);
        Fill(0.98, 0.97, 0.94); Rect(42, 363, 528, 25);
        TextAt("Total deductions", 56, 372, 9, "/F1");
        RightText(Money(deductions), 554, 372, 9, "/F1");
        Fill(0.06, 0.55, 0.65); Rect(42, 278, 528, 62);
        TextAt("NET PAY", 58, 316, 10, "/F2", 1, 1, 1);
        TextAt("Amount credited to employee", 58, 296, 8, "/F1", 0.82, 0.96, 0.98);
        RightText(Money(net), 554, 300, 18, "/F2", 1, 1, 1);

        // Payment details and footer
        Fill(0.96, 0.98, 0.99); Rect(42, 204, 528, 50);
        Stroke(0.85, 0.89, 0.92); Rect(42, 204, 528, 50, false);
        LabelValue("Payment method", paymentMethod, 58, 218, 150);
        LabelValue("Payment reference", reference, 240, 218, 190);
        LabelValue("Statement date", DateTime.UtcNow.ToString("dd MMM yyyy", CultureInfo.InvariantCulture), 458, 218, 90);
        Stroke(0.85, 0.89, 0.92); Line(42, 78, 570, 78);
        TextAt("This document is system generated and does not require a signature.", 42, 60, 8, "/F1", 0.40, 0.46, 0.52);
        RightText("Generated by HR Employee Portal", 570, 60, 8, "/F1", 0.40, 0.46, 0.52);

        var objects = new[] {
            "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
            $"<< /Length {Encoding.ASCII.GetByteCount(content.ToString())} >>\nstream\n{content}\nendstream"
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

    [HttpGet("my-benefits")]
    public async Task<IActionResult> MyBenefits(CancellationToken ct)
    {
        var self = CurrentUser.EmployeeId(User);
        if (self is null or <= 0)
            return Ok(Array.Empty<object>());
        return Ok(await _hr.MyBenefitsAsync(self.Value, ct));
    }

    [HttpGet("{employeeId:int}/benefits")]
    public async Task<IActionResult> EmployeeBenefits(int employeeId, CancellationToken ct)
    {
        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null || self.Value != employeeId) return Forbid();
        }
        return Ok(await _hr.MyBenefitsAsync(employeeId, ct));
    }

    [HttpGet("total-rewards")]
    public async Task<IActionResult> MyTotalRewards(CancellationToken ct)
    {
        var self = CurrentUser.EmployeeId(User);
        if (self is null or <= 0)
            return Ok(new Dictionary<string, object?> { ["error"] = "Employee not identified" });
        return Ok(await _hr.TotalRewardsAsync(self.Value, ct));
    }

    [HttpGet("{employeeId:int}/total-rewards")]
    public async Task<IActionResult> EmployeeTotalRewards(int employeeId, CancellationToken ct)
    {
        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null || self.Value != employeeId) return Forbid();
        }
        return Ok(await _hr.TotalRewardsAsync(employeeId, ct));
    }

    [HttpGet("total-rewards/pdf")]
    public async Task<IActionResult> MyTotalRewardsPdf(CancellationToken ct)
    {
        var self = CurrentUser.EmployeeId(User);
        if (self is null or <= 0) return NotFound(new { error = "Employee not found." });
        var statement = await _hr.TotalRewardsAsync(self.Value, ct);
        if (statement.ContainsKey("error")) return NotFound(new { error = statement["error"] });
        var pdf = BuildTotalRewardsPdf(statement);
        var code = Convert.ToString(statement.GetValueOrDefault("employeeCode"), CultureInfo.InvariantCulture) ?? "EMP";
        return File(pdf, "application/pdf", $"Total-Rewards-{code}.pdf");
    }

    [HttpGet("{employeeId:int}/total-rewards/pdf")]
    public async Task<IActionResult> EmployeeTotalRewardsPdf(int employeeId, CancellationToken ct)
    {
        if (CurrentUser.IsEmployee(User))
        {
            var self = CurrentUser.EmployeeId(User);
            if (self is null || self.Value != employeeId) return Forbid();
        }
        var statement = await _hr.TotalRewardsAsync(employeeId, ct);
        if (statement.ContainsKey("error")) return NotFound(new { error = statement["error"] });
        var pdf = BuildTotalRewardsPdf(statement);
        var code = Convert.ToString(statement.GetValueOrDefault("employeeCode"), CultureInfo.InvariantCulture) ?? "EMP";
        return File(pdf, "application/pdf", $"Total-Rewards-{code}.pdf");
    }

    private static byte[] BuildTotalRewardsPdf(Dictionary<string, object?> stmt)
    {
        static string Text(Dictionary<string, object?> row, string key) => Convert.ToString(row.GetValueOrDefault(key), CultureInfo.InvariantCulture)?.Trim() is { Length: > 0 } value ? value : "-";
        static decimal Amount(Dictionary<string, object?> row, string key)
        {
            var value = row.GetValueOrDefault(key);
            if (value is decimal dec) return dec;
            return decimal.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0m;
        }
        static string Money(decimal value) => $"AED {value.ToString("N2", CultureInfo.InvariantCulture)}";
        static string PdfText(string value) => value.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)").Replace("\r", " ").Replace("\n", " ");
        static string Clip(string value, int max) => value.Length <= max ? value : value[..Math.Max(0, max - 3)] + "...";

        var employee = Text(stmt, "fullName");
        var empCode = Text(stmt, "employeeCode");
        var jobTitle = Text(stmt, "jobTitle");
        var department = Text(stmt, "departmentName");
        var division = Text(stmt, "divisionName");
        var joinDate = Text(stmt, "joinDate");
        var serviceYears = Text(stmt, "serviceYears");

        var basicAnnual = Amount(stmt, "annualBasicSalary");
        var allowAnnual = Amount(stmt, "annualAllowances");
        var cashAnnual = Amount(stmt, "annualCashSalary");
        var benefitsAnnual = Amount(stmt, "annualEmployerBenefits");
        var gratuity = Amount(stmt, "accruedGratuity");
        var flight = Amount(stmt, "annualFlightAllowance");
        var totalAnnual = Amount(stmt, "totalAnnualValue");

        var content = new StringBuilder();
        void Fill(double r, double g, double b) => content.AppendFormat(CultureInfo.InvariantCulture, "{0:0.###} {1:0.###} {2:0.###} rg\n", r, g, b);
        void Stroke(double r, double g, double b) => content.AppendFormat(CultureInfo.InvariantCulture, "{0:0.###} {1:0.###} {2:0.###} RG\n", r, g, b);
        void Rect(double x, double y, double w, double h, bool fill = true) => content.AppendFormat(CultureInfo.InvariantCulture, "{0:0.##} {1:0.##} {2:0.##} {3:0.##} re {4}\n", x, y, w, h, fill ? "f" : "S");
        void Line(double x1, double y1, double x2, double y2) => content.AppendFormat(CultureInfo.InvariantCulture, "{0:0.##} {1:0.##} m {2:0.##} {3:0.##} l S\n", x1, y1, x2, y2);
        void TextAt(string value, double x, double y, double size, string font = "/F1", double r = 0.08, double g = 0.12, double b = 0.18)
        {
            Fill(r, g, b);
            content.AppendFormat(CultureInfo.InvariantCulture, "BT {0} {1:0.##} Tf 1 0 0 1 {2:0.##} {3:0.##} Tm ({4}) Tj ET\n", font, size, x, y, PdfText(value));
        }
        void RightText(string value, double right, double y, double size, string font = "/F1", double r = 0.08, double g = 0.12, double b = 0.18)
        {
            TextAt(value, right - (value.Length * size * 0.52), y, size, font, r, g, b);
        }
        void LabelValue(string label, string value, double x, double y)
        {
            TextAt(label.ToUpperInvariant(), x, y + 16, 7, "/F2", 0.35, 0.42, 0.50);
            TextAt(Clip(value, 36), x, y, 9.5, "/F2");
        }

        // Header - Executive Navy Banner
        Fill(0.04, 0.17, 0.26); Rect(0, 680, 612, 112);
        TextAt("TOTAL REWARDS STATEMENT", 42, 746, 21, "/F2", 1, 1, 1);
        TextAt(Clip(division, 60), 42, 724, 11, "/F2", 0.85, 0.95, 1);
        TextAt("COMPREHENSIVE ANNUAL COMPENSATION & BENEFITS OVERVIEW", 42, 706, 7.5, "/F1", 0.70, 0.85, 0.95);
        TextAt("CONFIDENTIAL", 475, 746, 8, "/F2", 0.72, 0.86, 0.92);

        // Employee Info Card
        Fill(0.96, 0.98, 0.99); Rect(42, 595, 528, 70);
        Stroke(0.85, 0.89, 0.92); Rect(42, 595, 528, 70, false);
        LabelValue("Employee Name", employee, 56, 634);
        LabelValue("Employee Code", empCode, 240, 634);
        LabelValue("Tenure / Service", $"{serviceYears} Years", 420, 634);
        LabelValue("Job Title", jobTitle, 56, 606);
        LabelValue("Department", department, 240, 606);
        LabelValue("Join Date", joinDate, 420, 606);

        // Grand Total Highlight Banner
        Fill(0.00, 0.55, 0.70); Rect(42, 515, 528, 64);
        TextAt("TOTAL ANNUAL REWARD VALUE", 58, 552, 10, "/F2", 1, 1, 1);
        TextAt("Guaranteed cash compensation + employer-sponsored healthcare + statutory EOSB + travel benefits", 58, 534, 7.5, "/F1", 0.85, 0.96, 1);
        RightText(Money(totalAnnual), 554, 536, 18, "/F2", 1, 1, 1);

        // Compensation Breakdown Table
        TextAt("ANNUAL COMPENSATION BREAKDOWN", 42, 490, 10, "/F2", 0.04, 0.17, 0.26);
        Fill(0.04, 0.17, 0.26); Rect(42, 465, 528, 20);
        TextAt("Component", 56, 471, 8, "/F2", 1, 1, 1);
        TextAt("Category", 260, 471, 8, "/F2", 1, 1, 1);
        RightText("Annual Value", 554, 471, 8, "/F2", 1, 1, 1);

        var compRows = new[] {
            ("Annual Base Salary", "Guaranteed Cash", basicAnnual),
            ("Annual Allowances (Housing / Transport / Mobile)", "Guaranteed Cash", allowAnnual),
            ("Total Guaranteed Annual Cash", "Subtotal (12x Monthly Gross)", cashAnnual),
            ("Corporate Medical & Life Insurance", "Employer Paid Benefit", benefitsAnnual),
            ("Accrued End-of-Service Gratuity (EOSB)", "Statutory Accrual (UAE Law)", gratuity),
            ("Annual Flight & Travel Allowance", "Corporate Travel Benefit", flight),
            ("Total Annual Value of Rewards", "Grand Total Value", totalAnnual)
        };

        var rowY = 442;
        foreach (var r in compRows)
        {
            var isSubtotal = r.Item2.StartsWith("Subtotal");
            var isGrand = r.Item2.StartsWith("Grand Total");
            if (isGrand)
            {
                Fill(0.88, 0.95, 0.99); Rect(42, rowY - 5, 528, 22);
            }
            else if (isSubtotal)
            {
                Fill(0.94, 0.96, 0.98); Rect(42, rowY - 5, 528, 22);
            }
            else
            {
                Fill(rowY % 40 == 0 ? 0.99 : 1.0, 1.0, 1.0); Rect(42, rowY - 5, 528, 22);
            }
            Stroke(0.88, 0.91, 0.93); Line(42, rowY - 5, 570, rowY - 5);
            var font = (isSubtotal || isGrand) ? "/F2" : "/F1";
            TextAt(r.Item1, 56, rowY + 3, 8.5, font);
            TextAt(r.Item2, 260, rowY + 3, 8, "/F1", 0.40, 0.48, 0.55);
            RightText(Money(r.Item3), 554, rowY + 3, 8.5, font);
            rowY -= 22;
        }

        // Explanatory Note Card
        Fill(0.97, 0.98, 0.99); Rect(42, 160, 528, 105);
        Stroke(0.85, 0.89, 0.92); Rect(42, 160, 528, 105, false);
        TextAt("STATEMENT METHODOLOGY & UAE LABOUR LAW GOVERNANCE", 56, 246, 8, "/F2", 0.04, 0.17, 0.26);
        TextAt("1. Basic Salary & Allowances are paid monthly via UAE Wages Protection System (WPS).", 56, 230, 7.5, "/F1", 0.35, 0.42, 0.50);
        TextAt("2. Healthcare Insurance is 100% employer-sponsored per DHA / MOHAP statutory regulations.", 56, 215, 7.5, "/F1", 0.35, 0.42, 0.50);
        TextAt("3. End of Service Gratuity (EOSB) is calculated per UAE Federal Decree-Law No. 33 of 2021", 56, 200, 7.5, "/F1", 0.35, 0.42, 0.50);
        TextAt("   (21 days basic salary/year for first 5 years; 30 days basic salary/year thereafter).", 56, 187, 7.5, "/F1", 0.35, 0.42, 0.50);
        TextAt("4. Flight allowance benchmark reflects annual corporate roundtrip ticket entitlement.", 56, 172, 7.5, "/F1", 0.35, 0.42, 0.50);

        // Footer
        Stroke(0.85, 0.89, 0.92); Line(42, 95, 570, 95);
        TextAt("This statement is an executive summary of total compensation and does not constitute a revised employment contract.", 42, 78, 7.5, "/F1", 0.45, 0.50, 0.55);
        TextAt($"Generated on: {DateTime.UtcNow.ToString("dd MMM yyyy HH:mm", CultureInfo.InvariantCulture)} UTC", 42, 66, 7.5, "/F1", 0.45, 0.50, 0.55);
        RightText("Synergy Human Resources Information System", 570, 66, 7.5, "/F2", 0.00, 0.55, 0.70);

        var objects = new[] {
            "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
            $"<< /Length {Encoding.ASCII.GetByteCount(content.ToString())} >>\nstream\n{content}\nendstream"
        };
        var output = new StringBuilder("%PDF-1.4\n"); var offsets = new List<int> { 0 };
        foreach (var (obj, i) in objects.Select((x, i) => (x, i + 1))) { offsets.Add(Encoding.ASCII.GetByteCount(output.ToString())); output.Append($"{i} 0 obj\n{obj}\nendobj\n"); }
        var xref = Encoding.ASCII.GetByteCount(output.ToString()); output.Append($"xref\n0 {objects.Length + 1}\n0000000000 65535 f \n");
        for (var i = 1; i < offsets.Count; i++) output.Append($"{offsets[i]:D10} 00000 n \n");
        output.Append($"trailer\n<< /Size {objects.Length + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF");
        return Encoding.ASCII.GetBytes(output.ToString());
    }
}

