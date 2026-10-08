namespace Zekra.Core;

public sealed record PrayerTime(Prayer Prayer, string Label, DateTimeOffset At);

/// <summary>A place's prayer day as the site's /prayer shows it.</summary>
public static class Schedule
{
    /// <summary>Today's six times at the place («الجمعة» for dhuhr on Fridays).</summary>
    public static PrayerTime[] Day(Place place, DateOnly day)
    {
        var data = ZekraData.Load();
        var times = PrayerCalc.TimesFor(day, place);
        return PrayerCalc.All
            .Where(p => times[(int)p] is not null)
            .Select(p => new PrayerTime(p,
                p == Prayer.Dhuhr && day.DayOfWeek == DayOfWeek.Friday ? "الجمعة" : data.LabelOf(p),
                times[(int)p]!.Value))
            .ToArray();
    }

    /// <summary>The prayers (not sunrise) after `now`, today's then tomorrow's.</summary>
    public static IEnumerable<PrayerTime> Upcoming(Place place, DateTimeOffset now)
    {
        var today = place.Today(now);
        return Day(place, today).Concat(Day(place, today.AddDays(1)))
            .Where(t => t.Prayer != Prayer.Sunrise && t.At > now);
    }

    public static PrayerTime Next(Place place, DateTimeOffset now) => Upcoming(place, now).First();

    /// <summary>«ساعتين و٥ دقائق»: the site's untilPhrase (src/app/(site)/prayer/prayer-app.tsx).</summary>
    public static string Until(int minutes)
    {
        var (h, m) = (minutes / 60, minutes % 60);
        var hours = h == 1 ? "ساعة" : h == 2 ? "ساعتين" : h > 0 ? $"{Arabic.Digits(h)} {(h <= 10 ? "ساعات" : "ساعة")}" : "";
        var mins = m == 1 ? "دقيقة" : m == 2 ? "دقيقتين" : m > 0 ? $"{Arabic.Digits(m)} {(m <= 10 ? "دقائق" : "دقيقة")}" : "";
        var phrase = string.Join(" و", new[] { hours, mins }.Where(x => x.Length > 0));
        return phrase.Length > 0 ? phrase : "أقل من دقيقة";
    }

    /// <summary>Whole minutes from now to a time, rounded as the site does.</summary>
    public static int MinutesUntil(DateTimeOffset at, DateTimeOffset now) => Math.Max(0, (int)Math.Round((at - now).TotalMinutes, MidpointRounding.AwayFromZero));

    /// <summary>«٠١:٢٣:٤٥» until a time.</summary>
    public static string Countdown(TimeSpan left)
    {
        if (left < TimeSpan.Zero) left = TimeSpan.Zero;
        return Arabic.Digits($"{(int)left.TotalHours:00}:{left.Minutes:00}:{left.Seconds:00}");
    }

    /// <summary>«٣:٠٥ م» in the place's time zone.</summary>
    public static string Clock(Place place, DateTimeOffset at)
    {
        var t = place.Local(at);
        var h = t.Hour % 12 == 0 ? 12 : t.Hour % 12;
        return Arabic.Digits($"{h}:{t.Minute:00}") + (t.Hour < 12 ? " ص" : " م");
    }

    /// <summary>«الخميس، ٨ أكتوبر ٢٠٢٦» (the site's ar-EG date line).</summary>
    public static string DateLine(DateOnly day) =>
        Arabic.Digits(day.ToDateTime(TimeOnly.MinValue).ToString("dddd، d MMMM yyyy", System.Globalization.CultureInfo.GetCultureInfo("ar-EG")));
}
