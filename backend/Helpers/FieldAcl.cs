using System.Text.Json;

namespace DigitalDive.Hr.Api.Helpers;

/// <summary>
/// Field-level ACL for compensation / banking data.
/// Visible to: admin (HR), or the employee viewing their own record.
/// Managers and peers see masked/omitted values.
/// </summary>
public static class FieldAcl
{
    public const string Mask = "••••••";

    private static readonly string[] SensitiveKeys =
    {
        "basicSalary", "basic_salary",
        "allowances",
        "bankIban", "bank_iban", "iban",
        "accountNumber", "account_number", "accountNo", "account_no",
        "bankAccount", "bank_account",
    };

    public static bool CanViewCompensation(string? role, int? viewerEmployeeId, int? subjectEmployeeId)
    {
        var r = (role ?? "").Trim().ToLowerInvariant();
        if (r is "admin" or "hr") return true;
        if (viewerEmployeeId is > 0 && subjectEmployeeId is > 0 && viewerEmployeeId == subjectEmployeeId)
            return true;
        return false;
    }

    public static Dictionary<string, object?> Apply(
        Dictionary<string, object?> row, string? role, int? viewerEmployeeId, bool mask = true)
    {
        var subjectId = ReadId(row);
        if (CanViewCompensation(role, viewerEmployeeId, subjectId))
            return row;

        var copy = new Dictionary<string, object?>(row, StringComparer.OrdinalIgnoreCase);
        foreach (var key in SensitiveKeys)
        {
            if (!copy.ContainsKey(key)) continue;
            if (mask) copy[key] = Mask;
            else copy.Remove(key);
        }

        // master_data JSON may embed IBAN / bank fields
        foreach (var mdKey in new[] { "masterData", "master_data" })
        {
            if (!copy.TryGetValue(mdKey, out var raw) || raw is null or DBNull) continue;
            copy[mdKey] = MaskMasterData(raw, mask);
        }

        return copy;
    }

    public static List<Dictionary<string, object?>> ApplyAll(
        IEnumerable<Dictionary<string, object?>> rows, string? role, int? viewerEmployeeId, bool mask = true) =>
        rows.Select(r => Apply(r, role, viewerEmployeeId, mask)).ToList();

    private static int? ReadId(Dictionary<string, object?> row)
    {
        if (row.TryGetValue("id", out var id) && id is not null and not DBNull)
            return Convert.ToInt32(id);
        return null;
    }

    private static object? MaskMasterData(object raw, bool mask)
    {
        try
        {
            Dictionary<string, object?>? dict = null;
            if (raw is Dictionary<string, object?> d)
                dict = new Dictionary<string, object?>(d, StringComparer.OrdinalIgnoreCase);
            else if (raw is string s && !string.IsNullOrWhiteSpace(s))
            {
                var parsed = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(s);
                if (parsed is not null)
                {
                    dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                    foreach (var kv in parsed)
                        dict[kv.Key] = kv.Value.ValueKind == JsonValueKind.Null ? null : kv.Value.ToString();
                }
            }
            else if (raw is JsonElement je && je.ValueKind == JsonValueKind.Object)
            {
                dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                foreach (var p in je.EnumerateObject())
                    dict[p.Name] = p.Value.ValueKind == JsonValueKind.Null ? null : p.Value.ToString();
            }

            if (dict is null) return raw;

            foreach (var key in new[] { "iban", "bankIban", "accountNumber", "accountNo", "basicSalary", "allowances" })
            {
                if (!dict.ContainsKey(key)) continue;
                if (mask) dict[key] = Mask;
                else dict.Remove(key);
            }
            return dict;
        }
        catch
        {
            return mask ? Mask : null;
        }
    }
}
