using DigitalDive.Hr.Api.Data;
using Npgsql;

namespace DigitalDive.Hr.Api.Services;

/// <summary>
/// UAE EOSB / gratuity calculator — preview defaults until Phase 0 golden cases are signed.
/// </summary>
public sealed class EosbCalculatorService
{
    private readonly Db _db;
    public EosbCalculatorService(Db db) => _db = db;

    public async Task<object> CalculatePreviewAsync(
        decimal basicSalary,
        double serviceYears,
        double unpaidLeaveDays,
        string? jurisdictionProfile,
        CancellationToken ct)
    {
        var profile = string.IsNullOrWhiteSpace(jurisdictionProfile) ? "uae_mainland" : jurisdictionProfile.Trim();
        await using var conn = _db.CreateConnection();
        await conn.OpenAsync(ct);

        await using var cmd = new NpgsqlCommand(
            """
            SELECT code, formula_version, first_years, days_per_year_first, days_per_year_after,
                   use_basic_salary_only, deduct_unpaid_leave, description
            FROM eosb_rule_versions
            WHERE is_active = TRUE AND jurisdiction_profile = @p
            ORDER BY effective_from DESC, id DESC
            LIMIT 1
            """, conn);
        cmd.Parameters.AddWithValue("p", profile);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
        {
            return new
            {
                isPreview = true,
                error = "No EOSB rule version configured for jurisdiction",
                jurisdictionProfile = profile,
            };
        }

        var code = reader.GetString(0);
        var formulaVersion = reader.GetString(1);
        var firstYears = reader.GetInt32(2);
        var daysFirst = reader.GetDecimal(3);
        var daysAfter = reader.GetDecimal(4);
        var deductUnpaid = reader.GetBoolean(6);
        var description = reader.IsDBNull(7) ? null : reader.GetString(7);
        await reader.CloseAsync();

        var years = Math.Max(0, serviceYears);
        if (deductUnpaid && unpaidLeaveDays > 0)
            years = Math.Max(0, years - (unpaidLeaveDays / 365.0));

        var y1 = Math.Min(years, firstYears);
        var y2 = Math.Max(0, years - firstYears);
        var daily = basicSalary / 30m;
        var amount = daily * daysFirst * (decimal)y1 + daily * daysAfter * (decimal)y2;

        return new
        {
            isPreview = true,
            previewLabel = "TEST / PREVIEW — not production-certified",
            ruleCode = code,
            formulaVersion,
            jurisdictionProfile = profile,
            description,
            inputs = new
            {
                basicSalary,
                serviceYearsRaw = serviceYears,
                unpaidLeaveDays,
                serviceYearsApplied = years,
            },
            breakdown = new
            {
                yearsInFirstBand = y1,
                daysPerYearFirst = daysFirst,
                yearsAfterBand = y2,
                daysPerYearAfter = daysAfter,
                dailyRate = daily,
            },
            eosbAmount = Math.Round(amount, 2),
        };
    }
}
