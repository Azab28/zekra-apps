namespace Zekra.Core;

public enum Prayer { Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha }

/// <summary>Where the times are for (src/lib/schedule/prayer-calc.ts Place).</summary>
public sealed record Place(
    string Name,
    double Latitude,
    double Longitude,
    string TimeZone,
    string CalcMethod = "Egyptian",
    bool Hanafi = false,
    IReadOnlyDictionary<Prayer, int>? Adjust = null)
{
    [System.Text.Json.Serialization.JsonIgnore]
    public TimeZoneInfo Zone => TimeZoneInfo.TryFindSystemTimeZoneById(TimeZone, out var tz) ? tz : TimeZoneInfo.Local;

    /// <summary>The calendar day it is now at this place.</summary>
    public DateOnly Today(DateTimeOffset now) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, Zone).DateTime);

    public DateTimeOffset Local(DateTimeOffset utc) => TimeZoneInfo.ConvertTime(utc, Zone);
}
