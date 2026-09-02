using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "Employees")]
[Route("api/employees")]
[Authorize]
public sealed class EmployeesController : ControllerBase
{
    private static readonly HashSet<string> PhotoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".webp"
    };

    private readonly HrQueryService _hr;
    private readonly EmployeeBulkService _bulk;
    private readonly IWebHostEnvironment _env;

    public EmployeesController(HrQueryService hr, EmployeeBulkService bulk, IWebHostEnvironment env)
    {
        _hr = hr;
        _bulk = bulk;
        _env = env;
    }

    /// <summary>Admin/manager: full ops list. Employee: self only (for forms).</summary>
    [HttpGet]
    [Authorize(Roles = "admin,manager,employee")]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var role = CurrentUser.Role(User).ToLowerInvariant();
        var rows = await _hr.EmployeesAsync(ct);
        if (role == "employee")
        {
            var id = CurrentUser.EmployeeId(User);
            if (!id.HasValue) return Ok(Array.Empty<object>());
            return Ok(rows.Where(r => Convert.ToInt32(r["id"]) == id.Value).ToList());
        }

        return Ok(rows);
    }

    [HttpGet("departments")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Departments(CancellationToken ct) =>
        Ok(await _hr.DepartmentsAsync(ct));

    [HttpGet("bulk/template")]
    [Authorize(Roles = "admin")]
    public IActionResult BulkTemplate()
    {
        var bytes = _bulk.BuildTemplate();
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "employee-bulk-template.xlsx");
    }

    [HttpPost("bulk")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> BulkUpload(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { error = "Upload an Excel file (.xlsx)." });
        }

        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { error = "Only .xlsx files are supported." });
        }

        await using var stream = file.OpenReadStream();
        var result = await _bulk.ImportAsync(stream, ct);
        return Ok(result);
    }

    /// <summary>Create employee record + mobile app login (employee role).</summary>
    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeRequest body, CancellationToken ct)
    {
        var jobTitle = body.JobTitle?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(jobTitle) && !body.DesignationId.HasValue)
        {
            return BadRequest(new { error = "Designation or job title is required." });
        }

        var fullName = !string.IsNullOrWhiteSpace(body.FullName)
            ? body.FullName.Trim()
            : string.Join(' ', new[] { body.FirstName, body.MiddleName, body.LastName }
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p!.Trim()));

        var (employee, error) = await _hr.CreateEmployeeWithLoginAsync(
            fullName,
            body.Email,
            body.Password,
            string.IsNullOrWhiteSpace(jobTitle) ? "Employee" : jobTitle,
            body.Phone,
            body.DepartmentId,
            body.DivisionId,
            body.DesignationId,
            body.EmploymentTypeId,
            body.ManagerId,
            body.JoinDate,
            body.Status ?? "active",
            body.MasterData,
            ct);

        if (error is not null)
        {
            return BadRequest(new { error });
        }

        return Ok(new
        {
            employee,
            login = new
            {
                email = body.Email.Trim().ToLowerInvariant(),
                role = "employee",
            },
            message = "Employee created. They can sign in on the mobile app with this email and password.",
        });
    }

    [HttpPatch("{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateEmployeeRequest body, CancellationToken ct)
    {
        var (employee, error) = await _hr.UpdateEmployeeAsync(id, body, ct);

        if (error is not null)
        {
            return error.Contains("not found", StringComparison.OrdinalIgnoreCase)
                ? NotFound(new { error })
                : BadRequest(new { error });
        }

        return Ok(new { employee, message = "Employee updated." });
    }

    [HttpPost("{id:int}/reset-password")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetEmployeePasswordRequest body, CancellationToken ct)
    {
        var (ok, error) = await _hr.ResetEmployeePasswordAsync(id, body.Password, ct);
        if (!ok) return BadRequest(new { error });
        return Ok(new { message = "App login password updated." });
    }

    /// <summary>Upload employee profile photo (not passport/CNIC — those stay in Documents).</summary>
    [HttpPost("{id:int}/photo")]
    [Authorize(Roles = "admin")]
    [RequestSizeLimit(5_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 5_000_000)]
    public async Task<IActionResult> UploadPhoto(int id, IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length <= 0)
            return BadRequest(new { error = "Photo file is required." });
        if (file.Length > 5_000_000)
            return BadRequest(new { error = "Photo too large (max 5MB)." });

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext) || !PhotoExtensions.Contains(ext))
            return BadRequest(new { error = "Use PNG, JPG, or WEBP only." });

        var existing = await _hr.EmployeeByIdAsync(id, ct);
        if (existing is null) return NotFound(new { error = "Employee not found." });

        var webRoot = string.IsNullOrWhiteSpace(_env.WebRootPath)
            ? Path.Combine(_env.ContentRootPath, "wwwroot")
            : _env.WebRootPath;
        var uploadDir = Path.Combine(webRoot, "uploads", "photos");
        System.IO.Directory.CreateDirectory(uploadDir);

        var storedName = $"emp_{id}_{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}{ext.ToLowerInvariant()}";
        var absolutePath = Path.Combine(uploadDir, storedName);
        await using (var stream = System.IO.File.Create(absolutePath))
        {
            await file.CopyToAsync(stream, ct);
        }

        var relativeRef = $"uploads/photos/{storedName}";
        var (employee, error) = await _hr.SetEmployeePhotoPathAsync(id, relativeRef, ct);
        if (error is not null) return BadRequest(new { error });

        return Ok(new { employee, photoPath = relativeRef, message = "Profile photo saved." });
    }

    [HttpGet("{id:int}/photo")]
    [Authorize(Roles = "admin,manager,employee")]
    public async Task<IActionResult> GetPhoto(int id, CancellationToken ct)
    {
        var row = await _hr.EmployeeByIdAsync(id, ct);
        if (row is null) return NotFound(new { error = "Employee not found." });

        var role = CurrentUser.Role(User).ToLowerInvariant();
        if (role == "employee")
        {
            var myId = CurrentUser.EmployeeId(User);
            if (!myId.HasValue || myId.Value != id) return Forbid();
        }

        var photoPath = Convert.ToString(row.GetValueOrDefault("photoPath") ?? row.GetValueOrDefault("photo_path"));
        if (string.IsNullOrWhiteSpace(photoPath))
            return NotFound(new { error = "No photo uploaded." });

        if (photoPath.Contains("..", StringComparison.Ordinal)
            || photoPath.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || photoPath.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Invalid photo path." });

        var webRoot = string.IsNullOrWhiteSpace(_env.WebRootPath)
            ? Path.Combine(_env.ContentRootPath, "wwwroot")
            : _env.WebRootPath;
        var absolutePath = Path.GetFullPath(Path.Combine(webRoot, photoPath.Replace('/', Path.DirectorySeparatorChar)));
        var uploadsRoot = Path.GetFullPath(Path.Combine(webRoot, "uploads", "photos"));
        if (!absolutePath.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Invalid photo path." });
        if (!System.IO.File.Exists(absolutePath))
            return NotFound(new { error = "Photo file missing on server." });

        var provider = new FileExtensionContentTypeProvider();
        if (!provider.TryGetContentType(absolutePath, out var contentType))
            contentType = "application/octet-stream";

        return PhysicalFile(absolutePath, contentType);
    }

    /// <summary>Safe directory for mobile/ESS — no salary fields.</summary>
    [HttpGet("directory")]
    [Authorize(Roles = "admin,manager,employee")]
    public async Task<IActionResult> Directory(CancellationToken ct)
    {
        var rows = await _hr.EmployeesAsync(ct);
        var safe = rows.Select(r => new
        {
            id = r.GetValueOrDefault("id"),
            empCode = r.GetValueOrDefault("empCode"),
            fullName = r.GetValueOrDefault("fullName"),
            email = r.GetValueOrDefault("email"),
            phone = r.GetValueOrDefault("phone"),
            jobTitle = r.GetValueOrDefault("jobTitle"),
            departmentName = r.GetValueOrDefault("departmentName"),
            status = r.GetValueOrDefault("status"),
        });
        return Ok(safe);
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = "admin,manager")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var row = await _hr.EmployeeByIdAsync(id, ct);
        return row is null ? NotFound(new { error = "Not found" }) : Ok(row);
    }
}
