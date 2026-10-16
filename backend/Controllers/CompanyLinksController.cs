using System.Data.Common;
using DigitalDive.Hr.Api.Data;
using DigitalDive.Hr.Api.Helpers;
using DigitalDive.Hr.Api.Models;
using DigitalDive.Hr.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "CompanyLinks")]
[Route("api/company-links")]
[Authorize]
public sealed class CompanyLinksController : ControllerBase
{
    private readonly Db _db;
    private readonly RbacService _rbac;
    private readonly ILogger<CompanyLinksController> _logger;

    public CompanyLinksController(
        Db db,
        RbacService rbac,
        ILogger<CompanyLinksController> logger)
    {
        _db = db;
        _rbac = rbac;
        _logger = logger;
    }

    private async Task<bool> IsAdminOrPermAsync(CancellationToken ct, params string[] codes)
    {
        var role = CurrentUser.Role(User);
        if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase)
            || string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase))
            return true;

        var perms = await _rbac.GetPermissionCodesForRoleAsync(role, ct);
        return codes.Any(code =>
            perms.Any(p => string.Equals(p, code, StringComparison.OrdinalIgnoreCase)));
    }

    /// <summary>
    /// GET /api/company-links
    /// Returns corporate bookmarks repository for internal tools and employee portals.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool all = false, CancellationToken ct = default)
    {
        var isAdmin = CurrentUser.IsAdmin(User);
        var filterActive = !(isAdmin && all);

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        var sql = filterActive
            ? """
              SELECT id, title, url, icon_key, category, sort_order, is_active, created_at, updated_at
              FROM company_links
              WHERE is_active = TRUE
              ORDER BY sort_order ASC, id ASC
              """
            : """
              SELECT id, title, url, icon_key, category, sort_order, is_active, created_at, updated_at
              FROM company_links
              ORDER BY sort_order ASC, id ASC
              """;

        await using var cmd = new NpgsqlCommand(sql, conn);
        var list = new List<Dictionary<string, object?>>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            list.Add(MapRow(reader));
        }

        return Ok(list);
    }

    /// <summary>
    /// POST /api/company-links
    /// Create new corporate bookmark (Admin role required).
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCompanyLinkDto body, CancellationToken ct)
    {
        if (!await IsAdminOrPermAsync(ct, "dashboard.view", "employees.list"))
            return Forbid();

        if (string.IsNullOrWhiteSpace(body.Title))
            return BadRequest(new { error = "Link title is required." });

        if (string.IsNullOrWhiteSpace(body.Url))
            return BadRequest(new { error = "Link URL is required." });

        var iconKey = string.IsNullOrWhiteSpace(body.IconKey) ? "external-link" : body.IconKey.Trim().ToLowerInvariant();
        var category = string.IsNullOrWhiteSpace(body.Category) ? "General" : body.Category.Trim();
        var sortOrder = body.SortOrder ?? 0;
        var isActive = body.IsActive ?? true;

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        const string sql = """
            INSERT INTO company_links (title, url, icon_key, category, sort_order, is_active, created_at, updated_at)
            VALUES (@title, @url, @iconKey, @category, @sortOrder, @isActive, NOW(), NOW())
            RETURNING id, title, url, icon_key, category, sort_order, is_active, created_at, updated_at;
            """;

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("title", body.Title.Trim());
        cmd.Parameters.AddWithValue("url", body.Url.Trim());
        cmd.Parameters.AddWithValue("iconKey", iconKey);
        cmd.Parameters.AddWithValue("category", category);
        cmd.Parameters.AddWithValue("sortOrder", sortOrder);
        cmd.Parameters.AddWithValue("isActive", isActive);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct))
        {
            return Ok(MapRow(reader));
        }

        return BadRequest(new { error = "Failed to create company link." });
    }

    /// <summary>
    /// PUT /api/company-links/{id}
    /// Update existing corporate bookmark (Admin role required).
    /// </summary>
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateCompanyLinkDto body, CancellationToken ct)
    {
        if (!await IsAdminOrPermAsync(ct, "dashboard.view", "employees.list"))
            return Forbid();

        if (string.IsNullOrWhiteSpace(body.Title))
            return BadRequest(new { error = "Link title is required." });

        if (string.IsNullOrWhiteSpace(body.Url))
            return BadRequest(new { error = "Link URL is required." });

        var iconKey = string.IsNullOrWhiteSpace(body.IconKey) ? "external-link" : body.IconKey.Trim().ToLowerInvariant();
        var category = string.IsNullOrWhiteSpace(body.Category) ? "General" : body.Category.Trim();
        var sortOrder = body.SortOrder ?? 0;
        var isActive = body.IsActive ?? true;

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        const string sql = """
            UPDATE company_links
            SET title = @title,
                url = @url,
                icon_key = @iconKey,
                category = @category,
                sort_order = @sortOrder,
                is_active = @isActive,
                updated_at = NOW()
            WHERE id = @id
            RETURNING id, title, url, icon_key, category, sort_order, is_active, created_at, updated_at;
            """;

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("title", body.Title.Trim());
        cmd.Parameters.AddWithValue("url", body.Url.Trim());
        cmd.Parameters.AddWithValue("iconKey", iconKey);
        cmd.Parameters.AddWithValue("category", category);
        cmd.Parameters.AddWithValue("sortOrder", sortOrder);
        cmd.Parameters.AddWithValue("isActive", isActive);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct))
        {
            return Ok(MapRow(reader));
        }

        return NotFound(new { error = $"Company link #{id} not found." });
    }

    /// <summary>
    /// DELETE /api/company-links/{id}
    /// Delete corporate bookmark (Admin role required).
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!await IsAdminOrPermAsync(ct, "dashboard.view", "employees.list"))
            return Forbid();

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        await using var cmd = new NpgsqlCommand("DELETE FROM company_links WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", id);
        var rows = await cmd.ExecuteNonQueryAsync(ct);
        if (rows == 0) return NotFound(new { error = $"Company link #{id} not found." });

        return Ok(new { ok = true, message = $"Company link #{id} deleted." });
    }

    private static Dictionary<string, object?> MapRow(DbDataReader reader)
    {
        var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < reader.FieldCount; i++)
        {
            var name = reader.GetName(i);
            if (reader.IsDBNull(i))
            {
                row[ToCamel(name)] = null;
                continue;
            }

            var value = reader.GetValue(i);
            row[ToCamel(name)] = value switch
            {
                DateTime dt => dt.ToString("yyyy-MM-ddTHH:mm:ss"),
                DateTimeOffset dto => dto.ToString("yyyy-MM-ddTHH:mm:sszzz"),
                DateOnly d => d.ToString("yyyy-MM-dd"),
                _ => value
            };
        }
        return row;
    }

    private static string ToCamel(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;
        if (!name.Contains('_'))
        {
            return char.ToLowerInvariant(name[0]) + name[1..];
        }

        var parts = name.Split('_', StringSplitOptions.RemoveEmptyEntries);
        return parts[0].ToLowerInvariant()
               + string.Concat(parts.Skip(1).Select(p => char.ToUpperInvariant(p[0]) + p[1..].ToLowerInvariant()));
    }
}

public sealed record CreateCompanyLinkDto(
    string Title,
    string Url,
    string? IconKey,
    string? Category,
    int? SortOrder,
    bool? IsActive);
