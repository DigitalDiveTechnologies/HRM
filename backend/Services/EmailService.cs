using System.Net;
using System.Net.Mail;
using System.Text;
using DigitalDive.Hr.Api.Data;
using DigitalDive.Hr.Api.Models;
using Microsoft.Extensions.Options;
using Npgsql;

namespace DigitalDive.Hr.Api.Services;

/// <summary>SMTP email with Office 365 defaults. Logs and skips when unconfigured.</summary>
public sealed class EmailService
{
    private readonly Db _db;
    private readonly SmtpOptions _smtp;
    private readonly ILogger<EmailService> _logger;

    public EmailService(Db db, IOptions<SmtpOptions> smtp, ILogger<EmailService> logger)
    {
        _db = db;
        _smtp = smtp.Value;
        _logger = logger;
    }

    public bool IsConfigured =>
        _smtp.Enabled
        && !string.IsNullOrWhiteSpace(_smtp.Host)
        && !string.IsNullOrWhiteSpace(_smtp.FromEmail)
        && !string.IsNullOrWhiteSpace(_smtp.Username)
        && !string.IsNullOrWhiteSpace(_smtp.Password);

    public async Task SendLeaveAppliedAsync(
        int employeeId, string leaveType, decimal days, string startDate, string endDate, int? managerId,
        CancellationToken ct)
    {
        var employee = await EmployeeContactAsync(employeeId, ct);
        if (employee is null) return;

        var subject = $"Leave request submitted — {leaveType}";
        var body = Html(
            $"Hello {employee.Name},",
            $"<p>Your <strong>{WebUtility.HtmlEncode(leaveType)}</strong> leave request "
            + $"({days} day(s), {WebUtility.HtmlEncode(startDate)} to {WebUtility.HtmlEncode(endDate)}) "
            + "has been submitted and is pending manager approval.</p>");

        await SendSafeAsync(employee.Email, subject, body, ct);

        if (managerId is > 0)
        {
            var manager = await EmployeeContactAsync(managerId.Value, ct);
            if (manager is not null)
            {
                var mgrSubject = $"Leave approval needed — {employee.Name}";
                var mgrBody = Html(
                    $"Hello {manager.Name},",
                    $"<p><strong>{WebUtility.HtmlEncode(employee.Name)}</strong> ({WebUtility.HtmlEncode(employee.Code)}) "
                    + $"submitted a <strong>{WebUtility.HtmlEncode(leaveType)}</strong> leave request "
                    + $"({days} day(s), {WebUtility.HtmlEncode(startDate)} to {WebUtility.HtmlEncode(endDate)}).</p>"
                    + "<p>Please review in the HR mobile app (Team approvals).</p>");
                await SendSafeAsync(manager.Email, mgrSubject, mgrBody, ct);
            }
        }
    }

    public async Task SendLeaveApprovedAsync(
        int employeeId, string leaveType, decimal days, string approverStage, CancellationToken ct)
    {
        var employee = await EmployeeContactAsync(employeeId, ct);
        if (employee is null) return;

        var pendingHr = string.Equals(approverStage, "manager", StringComparison.OrdinalIgnoreCase);
        var subject = pendingHr
            ? $"Leave approved by manager — pending HR"
            : $"Leave approved — {leaveType}";
        var detail = pendingHr
            ? "Your manager approved your leave request. It is now pending HR final approval."
            : "Your leave request has been approved by HR.";
        var body = Html(
            $"Hello {employee.Name},",
            $"<p>{detail}</p>"
            + $"<p><strong>Type:</strong> {WebUtility.HtmlEncode(leaveType)}<br/>"
            + $"<strong>Days:</strong> {days}</p>");

        await SendSafeAsync(employee.Email, subject, body, ct);

        if (pendingHr)
            await SendToHrAdminsAsync(
                $"Leave pending HR approval — {employee.Name}",
                Html("HR team,", $"<p>{WebUtility.HtmlEncode(employee.Name)}'s {WebUtility.HtmlEncode(leaveType)} leave "
                                 + $"({days} days) was approved by their manager and awaits HR approval on the portal.</p>"),
                ct);
    }

    public async Task SendLeaveRejectedAsync(
        int employeeId, string leaveType, string? rejectedBy, CancellationToken ct)
    {
        var employee = await EmployeeContactAsync(employeeId, ct);
        if (employee is null) return;

        var by = string.IsNullOrWhiteSpace(rejectedBy) ? "the approver" : rejectedBy.Trim();
        var body = Html(
            $"Hello {employee.Name},",
            $"<p>Your <strong>{WebUtility.HtmlEncode(leaveType)}</strong> leave request was rejected by {WebUtility.HtmlEncode(by)}.</p>"
            + "<p>Contact HR if you have questions.</p>");

        await SendSafeAsync(employee.Email, $"Leave rejected — {leaveType}", body, ct);
    }

    public async Task SendCertificateRequestedAsync(
        int employeeId, string certificateType, CancellationToken ct)
    {
        var employee = await EmployeeContactAsync(employeeId, ct);
        if (employee is null) return;

        var typeLabel = CertificateGeneratorService.TypeLabel(certificateType);
        var body = Html(
            $"Hello {employee.Name},",
            $"<p>Your <strong>{WebUtility.HtmlEncode(typeLabel)}</strong> request was submitted and is pending HR review.</p>");

        await SendSafeAsync(employee.Email, $"Certificate request submitted — {typeLabel}", body, ct);

        await SendToHrAdminsAsync(
            $"New certificate request — {employee.Name}",
            Html("HR team,",
                $"<p><strong>{WebUtility.HtmlEncode(employee.Name)}</strong> ({WebUtility.HtmlEncode(employee.Code)}) "
                + $"requested a <strong>{WebUtility.HtmlEncode(typeLabel)}</strong>.</p>"
                + "<p>Review on the HR portal under Certificates.</p>"),
            ct);
    }

    public async Task SendCertificateIssuedAsync(
        int employeeId, string certificateType, CancellationToken ct)
    {
        var employee = await EmployeeContactAsync(employeeId, ct);
        if (employee is null) return;

        var typeLabel = CertificateGeneratorService.TypeLabel(certificateType);
        var body = Html(
            $"Hello {employee.Name},",
            $"<p>Your <strong>{WebUtility.HtmlEncode(typeLabel)}</strong> has been issued by HR.</p>"
            + "<p>You can view the status in the mobile app or download from the HR portal.</p>");

        await SendSafeAsync(employee.Email, $"Certificate issued — {typeLabel}", body, ct);
    }

    private async Task SendSafeAsync(string to, string subject, string htmlBody, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(to))
        {
            _logger.LogWarning("[Email skipped] Empty recipient for subject {Subject}", subject);
            return;
        }

        if (!IsConfigured)
        {
            _logger.LogInformation(
                "[Email skipped — SMTP not configured] To={To} Subject={Subject}",
                to, subject);
            return;
        }

        try
        {
            using var message = new MailMessage
            {
                From = new MailAddress(_smtp.FromEmail.Trim(), _smtp.FromName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true,
                BodyEncoding = Encoding.UTF8,
                SubjectEncoding = Encoding.UTF8
            };
            message.To.Add(to.Trim());

            using var client = new SmtpClient(_smtp.Host.Trim(), _smtp.Port)
            {
                EnableSsl = _smtp.UseTls,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
                Credentials = new NetworkCredential(_smtp.Username.Trim(), _smtp.Password)
            };

            await client.SendMailAsync(message, ct);
            _logger.LogInformation("Email sent to {To}: {Subject}", to, subject);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Email send failed to {To} (subject: {Subject})", to, subject);
        }
    }

    private async Task SendToHrAdminsAsync(string subject, string htmlBody, CancellationToken ct)
    {
        foreach (var email in await HrAdminEmailsAsync(ct))
            await SendSafeAsync(email, subject, htmlBody, ct);
    }

    private async Task<List<string>> HrAdminEmailsAsync(CancellationToken ct)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            SELECT DISTINCT LOWER(TRIM(u.email)) AS email
            FROM users u
            WHERE LOWER(u.role) = 'admin'
              AND u.email IS NOT NULL AND TRIM(u.email) <> ''
            """, conn);
        var list = new List<string>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var email = reader.GetString(0);
            if (!string.IsNullOrWhiteSpace(email)) list.Add(email);
        }
        return list;
    }

    private async Task<EmployeeContact?> EmployeeContactAsync(int employeeId, CancellationToken ct)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(
            """
            SELECT full_name, email, emp_code
            FROM employees
            WHERE id = @id AND email IS NOT NULL AND TRIM(email) <> ''
            """, conn);
        cmd.Parameters.AddWithValue("id", employeeId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return new EmployeeContact(
            reader.GetString(0),
            reader.GetString(1).Trim().ToLowerInvariant(),
            reader.IsDBNull(2) ? "—" : reader.GetString(2));
    }

    private static string Html(string greeting, string content) =>
        $"""
        <!DOCTYPE html>
        <html><body style="font-family:Segoe UI,Arial,sans-serif;color:#1a1a1a;line-height:1.5">
        <p>{WebUtility.HtmlEncode(greeting)}</p>
        {content}
        <p style="color:#666;font-size:12px;margin-top:24px">GOCs Global · HR System (Digital Dive)</p>
        </body></html>
        """;

    private sealed record EmployeeContact(string Name, string Email, string Code);
}
