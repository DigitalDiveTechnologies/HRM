using System.Net;
using System.Text;

namespace DigitalDive.Hr.Api.Services;

public static class CertificateGeneratorService
{
    public static string TypeLabel(string type) => type.ToLowerInvariant() switch
    {
        "bank" => "Bank Certificate",
        "salary" => "Salary Certificate",
        "noc_travel" => "NOC (Travel)",
        _ => "Certificate"
    };

    public static string BuildHtml(
        string certificateType,
        string fullName,
        string? empCode,
        string? designation,
        string? department,
        string? division,
        decimal? basicSalary,
        string? joinDate,
        string? purpose,
        string? bankName,
        string? travelDestination,
        DateTime issuedOn)
    {
        var title = TypeLabel(certificateType);
        var salaryText = basicSalary is > 0
            ? $"AED {basicSalary.Value:N2} per month (basic salary)"
            : "As per company records";
        var joinText = string.IsNullOrWhiteSpace(joinDate) ? "—" : joinDate;
        var body = certificateType.ToLowerInvariant() switch
        {
            "bank" => $"""
                <p>This is to certify that <strong>{Enc(fullName)}</strong>
                (Employee ID: <strong>{Enc(empCode ?? "—")}</strong>) is employed with
                <strong>GOCs Global</strong> as <strong>{Enc(designation ?? "Employee")}</strong>
                in the <strong>{Enc(department ?? "—")}</strong> department
                ({Enc(division ?? "—")} division).</p>
                <p>Monthly basic salary: <strong>{Enc(salaryText)}</strong>.
                Date of joining: <strong>{Enc(joinText)}</strong>.</p>
                <p>This certificate is issued upon request for banking purposes
                {BankClause(bankName)}.</p>
                """,
            "noc_travel" => $"""
                <p>This is to certify that <strong>{Enc(fullName)}</strong>
                (Employee ID: <strong>{Enc(empCode ?? "—")}</strong>) is employed with
                <strong>GOCs Global</strong> as <strong>{Enc(designation ?? "Employee")}</strong>.</p>
                <p>The company has <strong>no objection</strong> to the employee travelling to
                <strong>{Enc(travelDestination ?? "as stated in the travel application")}</strong>
                for the purpose of: {Enc(purpose ?? "official/personal travel as approved")}.</p>
                <p>During the travel period, the employee remains on the company payroll with
                monthly basic salary of <strong>{Enc(salaryText)}</strong>.</p>
                """,
            _ => $"""
                <p>This is to certify that <strong>{Enc(fullName)}</strong>
                (Employee ID: <strong>{Enc(empCode ?? "—")}</strong>) is employed with
                <strong>GOCs Global</strong> as <strong>{Enc(designation ?? "Employee")}</strong>
                in the <strong>{Enc(department ?? "—")}</strong> department.</p>
                <p>Monthly basic salary: <strong>{Enc(salaryText)}</strong>.
                Date of joining: <strong>{Enc(joinText)}</strong>.</p>
                <p>Purpose: {Enc(purpose ?? "General salary confirmation")}.</p>
                """
        };

        return $$"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="utf-8"/>
              <title>{{Enc(title)}} — {{Enc(fullName)}}</title>
              <style>
                body { font-family: Georgia, 'Times New Roman', serif; margin: 48px; color: #1a1a1a; line-height: 1.55; }
                .header { text-align: center; border-bottom: 2px solid #0d4f8b; padding-bottom: 16px; margin-bottom: 28px; }
                .header h1 { margin: 0; font-size: 26px; color: #0d4f8b; letter-spacing: 0.04em; }
                .header p { margin: 6px 0 0; color: #555; font-size: 13px; }
                .title { text-align: center; font-size: 20px; font-weight: bold; margin: 24px 0; text-decoration: underline; }
                .body p { margin: 0 0 14px; font-size: 15px; }
                .footer { margin-top: 48px; }
                .sig { margin-top: 36px; }
                .demo { margin-top: 32px; padding: 10px 14px; background: #fff8e6; border: 1px dashed #c9a227; font-size: 12px; color: #6b5a1e; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>GOCs GLOBAL</h1>
                <p>Human Resources · Dubai, UAE</p>
              </div>
              <div class="title">{{Enc(title)}}</div>
              <div class="body">
                <p>Date: <strong>{{issuedOn:dd MMMM yyyy}}</strong></p>
                {{body}}
                <p>This certificate is issued at the request of the employee for official use.</p>
              </div>
              <div class="footer">
                <div class="sig">
                  <p>______________________________</p>
                  <p><strong>Authorized Signatory</strong><br/>Human Resources Department</p>
                </div>
                <div class="demo">
                  Demo template — client Word/PDF letterhead will replace this layout in final delivery.
                  Use browser Print → Save as PDF for a PDF copy.
                </div>
              </div>
            </body>
            </html>
            """;
    }

    public static async Task<string> SaveHtmlAsync(string contentRoot, int requestId, string html, CancellationToken ct)
    {
        var dir = Path.Combine(contentRoot, "wwwroot", "uploads", "certificates");
        Directory.CreateDirectory(dir);
        var fileName = $"certificate-{requestId}.html";
        var fullPath = Path.Combine(dir, fileName);
        await File.WriteAllTextAsync(fullPath, html, Encoding.UTF8, ct);
        return $"uploads/certificates/{fileName}";
    }

    private static string BankClause(string? bankName) =>
        string.IsNullOrWhiteSpace(bankName)
            ? "with their bank"
            : $"with <strong>{Enc(bankName.Trim())}</strong>";

    private static string Enc(string? value) =>
        WebUtility.HtmlEncode(value ?? string.Empty);
}
