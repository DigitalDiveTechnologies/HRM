using DigitalDive.Hr.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using System.Text.Json;

namespace DigitalDive.Hr.Api.Controllers;

[ApiController]
[ApiExplorerSettings(GroupName = "CustomFields")]
[Route("api/custom-fields")]
[Authorize]
public sealed class CustomFieldsController : ControllerBase
{
    private readonly Db _db;

    public CustomFieldsController(Db db)
    {
        _db = db;
    }

    [HttpGet("schema")]
    public async Task<IActionResult> GetSchema(CancellationToken ct = default)
    {
        return await GetFields(includeInactive: false, ct);
    }

    [HttpPost("schema")]
    [Authorize(Roles = "admin,manager")]
    public async Task<IActionResult> CreateSchemaField([FromBody] DigitalDive.Hr.Api.Models.CustomFieldSchemaRequest body, CancellationToken ct)
    {
        var createReq = new CustomFieldCreateRequest
        {
            FieldKey = body.FieldKey,
            Label = body.Label,
            FieldType = body.DataType ?? "text",
            IsRequired = body.Required,
            TabGroup = body.Category ?? "custom",
            Options = body.Options,
            SortOrder = 0
        };
        return await CreateField(createReq, ct);
    }

    [HttpGet]
    public async Task<IActionResult> GetFields([FromQuery] bool includeInactive = false, CancellationToken ct = default)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        var sql = includeInactive
            ? "SELECT id, tab_group, field_key, label, field_type, options_json, is_required, sort_order, is_active, created_at, updated_at FROM custom_field_definitions ORDER BY sort_order, id"
            : "SELECT id, tab_group, field_key, label, field_type, options_json, is_required, sort_order, is_active, created_at, updated_at FROM custom_field_definitions WHERE is_active = TRUE ORDER BY sort_order, id";

        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);

        var list = new List<Dictionary<string, object?>>();
        while (await reader.ReadAsync(ct))
        {
            var optionsRaw = reader.IsDBNull(5) ? null : reader.GetString(5);
            object? parsedOptions = null;
            if (!string.IsNullOrWhiteSpace(optionsRaw))
            {
                try
                {
                    parsedOptions = JsonSerializer.Deserialize<object>(optionsRaw);
                }
                catch
                {
                    parsedOptions = optionsRaw;
                }
            }

            list.Add(new Dictionary<string, object?>
            {
                ["id"] = reader.GetInt32(0),
                ["tabGroup"] = reader.GetString(1),
                ["fieldKey"] = reader.GetString(2),
                ["label"] = reader.GetString(3),
                ["fieldType"] = reader.GetString(4),
                ["optionsJson"] = parsedOptions,
                ["isRequired"] = reader.GetBoolean(6),
                ["sortOrder"] = reader.GetInt32(7),
                ["isActive"] = reader.GetBoolean(8),
                ["createdAt"] = reader.GetDateTime(9),
                ["updatedAt"] = reader.GetDateTime(10),
            });
        }

        return Ok(list);
    }

    [HttpPost]
    [Authorize(Roles = "admin,manager")]
    public async Task<IActionResult> CreateField([FromBody] CustomFieldCreateRequest body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.FieldKey) || string.IsNullOrWhiteSpace(body.Label))
        {
            return BadRequest(new { error = "field_key and label are required." });
        }

        var key = body.FieldKey.Trim().ToLowerInvariant().Replace(" ", "_").Replace("-", "_");
        var fieldType = string.IsNullOrWhiteSpace(body.FieldType) ? "text" : body.FieldType.Trim().ToLowerInvariant();
        if (fieldType is not ("text" or "number" or "date" or "select"))
        {
            return BadRequest(new { error = "field_type must be one of: text, number, date, select." });
        }

        string? optionsJson = null;
        if (body.Options is not null)
        {
            optionsJson = JsonSerializer.Serialize(body.Options);
        }

        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        await using var cmd = new NpgsqlCommand(
            """
            INSERT INTO custom_field_definitions (tab_group, field_key, label, field_type, options_json, is_required, sort_order, is_active)
            VALUES (@tab, @key, @label, @type, @opts::jsonb, @req, @sort, TRUE)
            RETURNING id, tab_group, field_key, label, field_type, options_json, is_required, sort_order, is_active, created_at, updated_at
            """, conn);

        cmd.Parameters.AddWithValue("tab", string.IsNullOrWhiteSpace(body.TabGroup) ? "custom" : body.TabGroup.Trim());
        cmd.Parameters.AddWithValue("key", key);
        cmd.Parameters.AddWithValue("label", body.Label.Trim());
        cmd.Parameters.AddWithValue("type", fieldType);
        cmd.Parameters.AddWithValue("opts", (object?)optionsJson ?? DBNull.Value);
        cmd.Parameters.AddWithValue("req", body.IsRequired);
        cmd.Parameters.AddWithValue("sort", body.SortOrder);

        try
        {
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                return Ok(new
                {
                    id = reader.GetInt32(0),
                    tabGroup = reader.GetString(1),
                    fieldKey = reader.GetString(2),
                    label = reader.GetString(3),
                    fieldType = reader.GetString(4),
                    optionsJson = body.Options,
                    isRequired = reader.GetBoolean(6),
                    sortOrder = reader.GetInt32(7),
                    isActive = reader.GetBoolean(8),
                });
            }
            return StatusCode(500, new { error = "Failed to insert custom field." });
        }
        catch (PostgresException ex) when (ex.SqlState == "23505")
        {
            return Conflict(new { error = $"A custom field with key '{key}' already exists." });
        }
    }

    [HttpPatch("{id:int}")]
    [Authorize(Roles = "admin,manager")]
    public async Task<IActionResult> UpdateField(int id, [FromBody] CustomFieldUpdateRequest body, CancellationToken ct)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        string? optionsJson = null;
        if (body.Options is not null)
        {
            optionsJson = JsonSerializer.Serialize(body.Options);
        }

        await using var cmd = new NpgsqlCommand(
            """
            UPDATE custom_field_definitions
            SET label = COALESCE(@label, label),
                tab_group = COALESCE(@tab, tab_group),
                field_type = COALESCE(@type, field_type),
                options_json = CASE WHEN @optsSet THEN @opts::jsonb ELSE options_json END,
                is_required = COALESCE(@req, is_required),
                sort_order = COALESCE(@sort, sort_order),
                is_active = COALESCE(@active, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = @id
            RETURNING id, tab_group, field_key, label, field_type, options_json, is_required, sort_order, is_active, updated_at
            """, conn);

        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("label", (object?)body.Label?.Trim() ?? DBNull.Value);
        cmd.Parameters.AddWithValue("tab", (object?)body.TabGroup?.Trim() ?? DBNull.Value);
        cmd.Parameters.AddWithValue("type", (object?)body.FieldType?.Trim().ToLowerInvariant() ?? DBNull.Value);
        cmd.Parameters.AddWithValue("optsSet", body.Options is not null);
        cmd.Parameters.AddWithValue("opts", (object?)optionsJson ?? DBNull.Value);
        cmd.Parameters.AddWithValue("req", (object?)body.IsRequired ?? DBNull.Value);
        cmd.Parameters.AddWithValue("sort", (object?)body.SortOrder ?? DBNull.Value);
        cmd.Parameters.AddWithValue("active", (object?)body.IsActive ?? DBNull.Value);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct))
        {
            return Ok(new
            {
                id = reader.GetInt32(0),
                tabGroup = reader.GetString(1),
                fieldKey = reader.GetString(2),
                label = reader.GetString(3),
                fieldType = reader.GetString(4),
                isRequired = reader.GetBoolean(6),
                sortOrder = reader.GetInt32(7),
                isActive = reader.GetBoolean(8),
            });
        }

        return NotFound(new { error = "Custom field definition not found." });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "admin,manager")]
    public async Task<IActionResult> DeleteField(int id, CancellationToken ct)
    {
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        await using var cmd = new NpgsqlCommand(
            "UPDATE custom_field_definitions SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", id);
        var rows = await cmd.ExecuteNonQueryAsync(ct);
        if (rows == 0) return NotFound(new { error = "Custom field definition not found." });
        return Ok(new { success = true, id });
    }
}

public sealed class CustomFieldCreateRequest
{
    public string? TabGroup { get; set; }
    public string FieldKey { get; set; } = "";
    public string Label { get; set; } = "";
    public string FieldType { get; set; } = "text";
    public object? Options { get; set; }
    public bool IsRequired { get; set; }
    public int SortOrder { get; set; }
}

public sealed class CustomFieldUpdateRequest
{
    public string? TabGroup { get; set; }
    public string? Label { get; set; }
    public string? FieldType { get; set; }
    public object? Options { get; set; }
    public bool? IsRequired { get; set; }
    public int? SortOrder { get; set; }
    public bool? IsActive { get; set; }
}
