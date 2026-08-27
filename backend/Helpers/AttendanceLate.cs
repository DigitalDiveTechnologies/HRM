namespace DigitalDive.Hr.Api.Helpers;

public static class AttendanceLate
{
    public static (string Status, int LateMinutes) Resolve(string? checkIn, string? status)
    {
        const int startMinutes = 9 * 60;
        var finalStatus = string.IsNullOrWhiteSpace(status) ? "present" : status.Trim().ToLowerInvariant();

        if (finalStatus == "leave")
        {
            return ("leave", 0);
        }

        var mins = MinutesFromTime(checkIn);
        var late = 0;

        if (mins is not null && mins > startMinutes)
        {
            late = mins.Value - startMinutes;
            finalStatus = "late";
        }
        else if (finalStatus == "late")
        {
            late = Math.Max(15, late);
        }

        return (finalStatus, late);
    }

    private static int? MinutesFromTime(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var parts = value.Trim().Split(':');
        if (parts.Length < 2) return null;
        if (!int.TryParse(parts[0], out var h) || !int.TryParse(parts[1].AsSpan(0, Math.Min(2, parts[1].Length)), out var m))
        {
            return null;
        }

        return h * 60 + m;
    }
}
