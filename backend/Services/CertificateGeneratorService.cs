using System.Net;
using System.Text;

namespace DigitalDive.Hr.Api.Services;

public static class CertificateGeneratorService
{
    public const string PortalVerifyBase = "https://gocs-hr-portal.vercel.app/verify/certificate";

    public static string TypeLabel(string type) => type.ToLowerInvariant() switch
    {
        "bank" => "Bank Certificate",
        "salary" => "Salary & Employment Certificate",
        "noc_travel" => "NOC (Travel)",
        _ => "Certificate"
    };

    public static string BuildVerifyUrl(int certId, string? empCode) =>
        $"{PortalVerifyBase}?id={certId}&emp={Uri.EscapeDataString(empCode ?? "")}";

    public static string BuildHtml(
        string certificateType,
        string fullName,
        string? empCode,
        string? designation,
        string? department,
        string? division,
        decimal? basicSalary,
        decimal? allowances,
        string? joinDate,
        string? purpose,
        string? bankName,
        string? travelDestination,
        DateTime issuedOn,
        int certificateId,
        string? legalEntityName = null)
    {
        var title = TypeLabel(certificateType);
        var entity = string.IsNullOrWhiteSpace(legalEntityName)
            ? (string.IsNullOrWhiteSpace(division) ? "GOCs Global" : division!)
            : legalEntityName!;
        var basic = basicSalary is > 0 ? basicSalary.Value : 0m;
        var allow = allowances is > 0 ? allowances.Value : 0m;
        var gross = basic + allow;
        var salaryText = basic > 0
            ? $"AED {basic:N2} per month (basic)"
            : "As per company records";
        var grossText = gross > 0 ? $"AED {gross:N2}" : "As per company records";
        var joinText = string.IsNullOrWhiteSpace(joinDate) ? "—" : joinDate;
        var verifyUrl = BuildVerifyUrl(certificateId, empCode);
        var qrImg = $"https://api.qrserver.com/v1/create-qr-code/?size=140x140&data={Uri.EscapeDataString(verifyUrl)}";

        var body = certificateType.ToLowerInvariant() switch
        {
            "bank" => $"""
                <p>This is to certify that <strong>{Enc(fullName)}</strong>
                (Employee ID: <strong>{Enc(empCode ?? "—")}</strong>) is employed with
                <strong>{Enc(entity)}</strong> as <strong>{Enc(designation ?? "Employee")}</strong>
                in the <strong>{Enc(department ?? "—")}</strong> department.</p>
                <table class="meta">
                  <tr><td>Legal entity</td><td>{Enc(entity)}</td></tr>
                  <tr><td>Date of joining</td><td>{Enc(joinText)}</td></tr>
                  <tr><td>Basic salary</td><td>{Enc(salaryText)}</td></tr>
                  <tr><td>Total gross</td><td>{Enc(grossText)}</td></tr>
                </table>
                <p>This certificate is issued upon request for banking purposes
                {BankClause(bankName)}.</p>
                """,
            "noc_travel" => $"""
                <p>This is to certify that <strong>{Enc(fullName)}</strong>
                (Employee ID: <strong>{Enc(empCode ?? "—")}</strong>) is employed with
                <strong>{Enc(entity)}</strong> as <strong>{Enc(designation ?? "Employee")}</strong>.</p>
                <p>The company has <strong>no objection</strong> to the employee travelling to
                <strong>{Enc(travelDestination ?? "as stated in the travel application")}</strong>
                for the purpose of: {Enc(purpose ?? "official/personal travel as approved")}.</p>
                <p>During the travel period, the employee remains on the company payroll with
                monthly basic salary of <strong>{Enc(salaryText)}</strong>.</p>
                """,
            _ => $"""
                <p>This is to certify that <strong>{Enc(fullName)}</strong>
                (Employee ID: <strong>{Enc(empCode ?? "—")}</strong>) is employed with
                <strong>{Enc(entity)}</strong> as <strong>{Enc(designation ?? "Employee")}</strong>
                in the <strong>{Enc(department ?? "—")}</strong> department.</p>
                <table class="meta">
                  <tr><td>Legal entity / company</td><td>{Enc(entity)}</td></tr>
                  <tr><td>Full name</td><td>{Enc(fullName)}</td></tr>
                  <tr><td>Designation</td><td>{Enc(designation ?? "Employee")}</td></tr>
                  <tr><td>Date of joining</td><td>{Enc(joinText)}</td></tr>
                  <tr><td>Basic salary</td><td>{Enc(salaryText)}</td></tr>
                  <tr><td>Total gross</td><td>{Enc(grossText)}</td></tr>
                  <tr><td>Date of issue</td><td>{issuedOn:dd MMMM yyyy}</td></tr>
                </table>
                <p>Purpose: {Enc(purpose ?? "UAE salary &amp; employment confirmation")}.</p>
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
                table.meta { width: 100%; border-collapse: collapse; margin: 16px 0 20px; font-size: 14px; }
                table.meta td { padding: 8px 10px; border: 1px solid #d0d7de; }
                table.meta td:first-child { width: 40%; background: #f6f8fa; font-weight: 600; }
                .footer { margin-top: 36px; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
                .sig { flex: 1; }
                .qr { text-align: center; font-size: 11px; color: #555; }
                .qr img { display: block; margin: 0 auto 6px; border: 1px solid #ddd; }
                .verify { word-break: break-all; max-width: 160px; margin: 0 auto; }
                .demo { margin-top: 28px; padding: 10px 14px; background: #fff8e6; border: 1px dashed #c9a227; font-size: 12px; color: #6b5a1e; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>{{Enc(entity.ToUpperInvariant())}}</h1>
                <p>Human Resources · Dubai, UAE</p>
              </div>
              <div class="title">{{Enc(title)}}</div>
              <div class="body">
                <p>Date: <strong>{{issuedOn:dd MMMM yyyy}}</strong></p>
                {{body}}
                <p>This certificate is issued at the request of the employee for official use.
                Authenticity can be verified via the QR code below.</p>
              </div>
              <div class="footer">
                <div class="sig">
                  <p>______________________________</p>
                  <p><strong>Authorized Signatory</strong><br/>Human Resources Department</p>
                </div>
                <div class="qr">
                  <img src="{{qrImg}}" width="140" height="140" alt="Verification QR"/>
                  <div>Scan to verify</div>
                  <div class="verify">Cert #{{certificateId}}</div>
                </div>
              </div>
              <div class="demo">
                Print → Save as PDF for a PDF copy. QR links to the public verification portal.
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
