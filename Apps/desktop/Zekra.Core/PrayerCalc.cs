namespace Zekra.Core;

/// <summary>Prayer times as src/lib/schedule/prayer-calc.ts computes them (prayerTimesFor).</summary>
public static class PrayerCalc
{
    public const int MaxAdjustMinutes = 30;

    public static readonly Prayer[] All = [Prayer.Fajr, Prayer.Sunrise, Prayer.Dhuhr, Prayer.Asr, Prayer.Maghrib, Prayer.Isha];

    /// <summary>The six times for a calendar day; null where the time doesn't exist that day.</summary>
    public static DateTimeOffset?[] TimesFor(DateOnly day, Place place)
    {
        var p = AdhanParams.For(place.CalcMethod) ?? AdhanParams.For("Egyptian")!;
        p.Hanafi = place.Hanafi;
        if (place.Adjust is { } adjust)
            foreach (var (k, v) in adjust) p.Adjustments[(int)k] += Math.Clamp(v, -MaxAdjustMinutes, MaxAdjustMinutes);
        return Adhan.Times(place.Latitude, place.Longitude, day.Year, day.Month, day.Day, p)
            .Select(ms => double.IsNaN(ms) ? (DateTimeOffset?)null : DateTimeOffset.FromUnixTimeMilliseconds((long)ms))
            .ToArray();
    }
}
