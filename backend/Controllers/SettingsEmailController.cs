using DigitalDive.Hr.Api.Data;
using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using System.Net;
using System.Net.Mail;
using System.Text;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Settings")]
[Route("api/settings/email")]
[Authorize]
public sealed class SettingsEmailController : ControllerBase
{
    private readonly Db _db;
    private readonly EmailService _emailService;
    private readonly ILogger<SettingsEmailController> _logger;

    public SettingsEmailController(Db db, EmailService emailService, ILogger<SettingsEmailController> logger)
    {
        _db = db;
        _emailService = emailService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetSettings(CancellationToken ct)
    {
        var role = CurrentUser.Role(User);
        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        var dbSmtp = await _emailService.GetDbSmtpAsync(ct);
        var effective = await _emailService.GetEffectiveSmtpAsync(ct);

        // Mask password for security
        var maskedPassword = !string.IsNullOrWhiteSpace(effective.Password)
            ? (effective.Password.Length > 4 ? "••••••••" + effective.Password[^4..] : "••••••••")
            : "";

        return Ok(new
        {
            host = effective.Host,
            port = effective.Port,
            username = effective.Username,
            password = maskedPassword,
            hasPassword = !string.IsNullOrWhiteSpace(effective.Password),
            fromEmail = effective.FromEmail,
            fromName = effective.FromName,
            useTls = effective.UseTls,
            isActive = effective.Enabled,
            source = dbSmtp != null && dbSmtp.Enabled ? "database" : "appsettings"
        });
    }

    [HttpPut]
    public async Task<IActionResult> UpdateSettings([FromBody] EmailSettingsUpdateRequest req, CancellationToken ct)
    {
        var role = CurrentUser.Role(User);
        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(req.Host))
            return BadRequest(new { error = "Host is required (e.g., smtp.gmail.com or smtp.office365.com)." });
        if (req.Port <= 0 || req.Port > 65535)
            return BadRequest(new { error = "Valid Port number is required (e.g. 587 or 465)." });

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        // Fetch current password if req.Password is blank or masked
        string passwordToSave = req.Password?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(passwordToSave) || passwordToSave.StartsWith("••••"))
        {
            const string queryPwd = "SELECT password FROM app_email_settings WHERE id = 1";
            await using var cmdPwd = new NpgsqlCommand(queryPwd, conn);
            var existingPwd = await cmdPwd.ExecuteScalarAsync(ct);
            passwordToSave = existingPwd?.ToString() ?? "";
        }

        const string sql = @"
            INSERT INTO app_email_settings (id, host, port, username, password, from_email, from_name, use_tls, is_active, updated_at)
            VALUES (1, @host, @port, @username, @password, @from_email, @from_name, @use_tls, @is_active, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
                host = EXCLUDED.host,
                port = EXCLUDED.port,
                username = EXCLUDED.username,
                password = EXCLUDED.password,
                from_email = EXCLUDED.from_email,
                from_name = EXCLUDED.from_name,
                use_tls = EXCLUDED.use_tls,
                is_active = EXCLUDED.is_active,
                updated_at = CURRENT_TIMESTAMP;";

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("host", req.Host.Trim());
        cmd.Parameters.AddWithValue("port", req.Port);
        cmd.Parameters.AddWithValue("username", req.Username?.Trim() ?? "");
        cmd.Parameters.AddWithValue("password", passwordToSave);
        cmd.Parameters.AddWithValue("from_email", req.FromEmail?.Trim() ?? (req.Username?.Trim() ?? ""));
        cmd.Parameters.AddWithValue("from_name", string.IsNullOrWhiteSpace(req.FromName) ? "GOCs HR" : req.FromName.Trim());
        cmd.Parameters.AddWithValue("use_tls", req.UseTls);
        cmd.Parameters.AddWithValue("is_active", req.IsActive);

        await cmd.ExecuteNonQueryAsync(ct);

        _logger.LogInformation("SMTP settings updated by {User}. Active={Active}, Host={Host}", CurrentUser.Email(User), req.IsActive, req.Host);

        return Ok(new { success = true, message = "Email SMTP settings saved successfully." });
    }

    [HttpPost("test")]
    public async Task<IActionResult> TestConnection([FromBody] EmailTestRequest req, CancellationToken ct)
    {
        var role = CurrentUser.Role(User);
        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        var targetEmail = req.ToEmail?.Trim();
        if (string.IsNullOrWhiteSpace(targetEmail))
        {
            targetEmail = CurrentUser.Email(User);
        }

        if (string.IsNullOrWhiteSpace(targetEmail))
            return BadRequest(new { error = "Recipient email address is required for test." });

        var effective = await _emailService.GetEffectiveSmtpAsync(ct);
        if (string.IsNullOrWhiteSpace(effective.Host) || string.IsNullOrWhiteSpace(effective.Username) || string.IsNullOrWhiteSpace(effective.Password))
        {
            return BadRequest(new { error = "SMTP configuration is incomplete. Please enter Host, Username and Password." });
        }

        try
        {
            var senderEmail = !string.IsNullOrWhiteSpace(effective.FromEmail) ? effective.FromEmail.Trim() : effective.Username.Trim();
            var senderName = !string.IsNullOrWhiteSpace(effective.FromName) ? effective.FromName.Trim() : "GOCs HR";

            using var message = new MailMessage
            {
                From = new MailAddress(senderEmail, senderName),
                Subject = "GOCs UAE HRM — SMTP Test Connection Succeeded",
                Body = $@"
                    <div style=""font-family:sans-serif;max-width:550px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;"">
                        <div style=""color:#00b8db;font-size:20px;font-weight:bold;margin-bottom:12px;"">GOCs UAE HRM — System Alert</div>
                        <h2 style=""color:#101828;margin-top:0;"">SMTP Test Email Confirmed!</h2>
                        <p style=""color:#475569;line-height:1.6;"">Congratulations! Your email architecture is configured and communicating properly with <strong>{WebUtility.HtmlEncode(effective.Host)}</strong>.</p>
                        <table style=""width:100%;margin-top:16px;border-collapse:collapse;font-size:13px;"">
                            <tr><td style=""padding:6px 0;color:#64748b;"">Server Host:</td><td style=""font-weight:600;"">{WebUtility.HtmlEncode(effective.Host)}:{effective.Port}</td></tr>
                            <tr><td style=""padding:6px 0;color:#64748b;"">Sender Account:</td><td style=""font-weight:600;"">{WebUtility.HtmlEncode(senderEmail)}</td></tr>
                            <tr><td style=""padding:6px 0;color:#64748b;"">TLS Encryption:</td><td style=""font-weight:600;"">{(effective.UseTls ? "Enabled" : "Disabled")}</td></tr>
                            <tr><td style=""padding:6px 0;color:#64748b;"">Timestamp:</td><td style=""font-weight:600;"">{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC</td></tr>
                        </table>
                        <p style=""margin-top:20px;font-size:12px;color:#94a3b8;"">Automated Welcome Emails will now be delivered seamlessly to all newly onboarded employees.</p>
                    </div>",
                IsBodyHtml = true,
                BodyEncoding = Encoding.UTF8
            };
            message.To.Add(targetEmail);

            using var client = new SmtpClient(effective.Host.Trim(), effective.Port)
            {
                EnableSsl = effective.UseTls,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
                Credentials = new NetworkCredential(effective.Username.Trim(), effective.Password.Trim())
            };

            await client.SendMailAsync(message, ct);

            return Ok(new
            {
                success = true,
                message = $"Test email sent successfully to {targetEmail} via {effective.Host}!"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Test email dispatch failed via {Host}", effective.Host);
            return StatusCode(500, new
            {
                error = $"Failed to send test email: {ex.Message}"
            });
        }
    }
}

public sealed class EmailSettingsUpdateRequest
{
    public string Host { get; set; } = "smtp.gmail.com";
    public int Port { get; set; } = 587;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string? FromEmail { get; set; }
    public string? FromName { get; set; } = "GOCs HR";
    public bool UseTls { get; set; } = true;
    public bool IsActive { get; set; } = true;
}

public sealed class EmailTestRequest
{
    public string? ToEmail { get; set; }
}
