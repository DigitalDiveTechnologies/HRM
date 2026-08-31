namespace DigitalDive.Hr.Api.Models;

/// <summary>Office 365 / generic SMTP settings. Leave Enabled=false until client provides credentials.</summary>
public sealed class SmtpOptions
{
    public const string SectionName = "Smtp";

    public bool Enabled { get; set; }
    public string Host { get; set; } = "smtp.office365.com";
    public int Port { get; set; } = 587;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromEmail { get; set; } = string.Empty;
    public string FromName { get; set; } = "GOCs HR";
    public bool UseTls { get; set; } = true;
}
