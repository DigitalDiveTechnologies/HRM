using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Documents")]
[Route("api/documents")]
[Authorize(Roles = "admin,manager")]
public sealed class DocumentsController : ControllerBase
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx", ".xls", ".xlsx", ".txt"
    };

    private readonly HrQueryService _hr;
    private readonly IWebHostEnvironment _env;

    public DocumentsController(HrQueryService hr, IWebHostEnvironment env)
    {
        _hr = hr;
        _env = env;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await _hr.DocumentsAsync(ct));

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create([FromBody] DocumentCreateRequest body, CancellationToken ct)
    {
        if (body.EmployeeId <= 0)
            return BadRequest(new { error = "employeeId required" });
        if (string.IsNullOrWhiteSpace(body.DocType) || string.IsNullOrWhiteSpace(body.Title))
            return BadRequest(new { error = "docType and title required" });

        var row = await _hr.CreateDocumentAsync(
            body.EmployeeId,
            body.DocType.Trim(),
            body.Title.Trim(),
            body.FileRef,
            body.IssueDate,
            body.ExpiryDate,
            body.Status,
            ct);
        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpPost("upload")]
    [Authorize(Roles = "admin")]
    [RequestSizeLimit(20_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 20_000_000)]
    public async Task<IActionResult> Upload(
        [FromForm] int employeeId,
        [FromForm] string docType,
        [FromForm] string title,
        [FromForm] string? issueDate,
        [FromForm] string? expiryDate,
        IFormFile? file,
        CancellationToken ct)
    {
        if (employeeId <= 0)
            return BadRequest(new { error = "employeeId required" });
        if (string.IsNullOrWhiteSpace(docType) || string.IsNullOrWhiteSpace(title))
            return BadRequest(new { error = "docType and title required" });
        if (file is null || file.Length <= 0)
            return BadRequest(new { error = "file required" });
        if (file.Length > 20_000_000)
            return BadRequest(new { error = "file too large (max 20MB)" });

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext) || !AllowedExtensions.Contains(ext))
            return BadRequest(new { error = "unsupported file type" });

        var webRoot = string.IsNullOrWhiteSpace(_env.WebRootPath)
            ? Path.Combine(_env.ContentRootPath, "wwwroot")
            : _env.WebRootPath;
        var uploadDir = Path.Combine(webRoot, "uploads", "documents");
        Directory.CreateDirectory(uploadDir);

        var safeName = Path.GetFileNameWithoutExtension(file.FileName);
        safeName = string.Join("_", safeName.Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries));
        if (string.IsNullOrWhiteSpace(safeName)) safeName = "document";
        if (safeName.Length > 80) safeName = safeName[..80];

        var storedName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}_{safeName}{ext.ToLowerInvariant()}";
        var absolutePath = Path.Combine(uploadDir, storedName);
        await using (var stream = System.IO.File.Create(absolutePath))
        {
            await file.CopyToAsync(stream, ct);
        }

        var relativeRef = $"uploads/documents/{storedName}";
        var row = await _hr.CreateDocumentAsync(
            employeeId,
            docType.Trim(),
            title.Trim(),
            relativeRef,
            issueDate,
            expiryDate,
            "valid",
            ct);

        return StatusCode(StatusCodes.Status201Created, row);
    }

    [HttpGet("{id:int}/file")]
    public async Task<IActionResult> DownloadFile(int id, CancellationToken ct)
    {
        var doc = await _hr.DocumentByIdAsync(id, ct);
        if (doc is null) return NotFound(new { error = "document not found" });

        var fileRef = Convert.ToString(doc.GetValueOrDefault("fileRef") ?? doc.GetValueOrDefault("file_ref"));
        if (string.IsNullOrWhiteSpace(fileRef))
            return NotFound(new { error = "no file attached" });

        // Only allow local uploaded files through this endpoint (not arbitrary URLs)
        if (fileRef.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || fileRef.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            || fileRef.Contains("..", StringComparison.Ordinal))
            return BadRequest(new { error = "unsupported file reference" });

        var webRoot = string.IsNullOrWhiteSpace(_env.WebRootPath)
            ? Path.Combine(_env.ContentRootPath, "wwwroot")
            : _env.WebRootPath;
        var absolutePath = Path.GetFullPath(Path.Combine(webRoot, fileRef.Replace('/', Path.DirectorySeparatorChar)));
        var uploadsRoot = Path.GetFullPath(Path.Combine(webRoot, "uploads"));
        if (!absolutePath.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "invalid file path" });
        if (!System.IO.File.Exists(absolutePath))
            return NotFound(new { error = "file missing on server" });

        var provider = new FileExtensionContentTypeProvider();
        if (!provider.TryGetContentType(absolutePath, out var contentType))
            contentType = "application/octet-stream";

        var downloadName = Path.GetFileName(absolutePath);
        return PhysicalFile(absolutePath, contentType, downloadName);
    }
}
