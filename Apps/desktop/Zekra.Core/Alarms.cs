namespace Zekra.Core;

public enum AdhanSound { Full, Short, Off }

/// <summary>The adhan and the reminder before it (Settings.Adhan).</summary>
public sealed class AdhanSettings
{
    public bool Enabled { get; set; } = true;
    public AdhanSound Sound { get; set; } = AdhanSound.Full;
    public string Voice { get; set; } = "adhan-muhammad-refaat";
    public int Volume { get; set; } = 80;
    /// <summary>Prayers whose adhan is shown without sound.</summary>
    public HashSet<Prayer> Muted { get; set; } = [];
    /// <summary>Minutes before the adhan for a reminder; 0 for none.</summary>
    public int BeforeMinutes { get; set; } = 10;
}

/// <summary>An adhan (or the reminder before it) that is due now.</summary>
public sealed record Alarm(PrayerTime Prayer, bool Before);

/// <summary>Decides when each adhan and reminder is due; each fires once.</summary>
public sealed class Alarms
{
    /// <summary>Missed by more than this (the computer slept), it isn't played late.</summary>
    public static readonly TimeSpan Grace = TimeSpan.FromMinutes(2);

    readonly HashSet<string> _fired = [];
    readonly List<(Alarm Alarm, DateTimeOffset At)> _tests = [];

    /// <summary>Test mode: the next prayer's adhan in a minute, its reminder half a minute before.</summary>
    public void Test(PrayerTime next, DateTimeOffset now)
    {
        var p = next with { At = now.AddMinutes(1) };
        _tests.Clear();
        _tests.Add((new Alarm(p, true), now.AddSeconds(30)));
        _tests.Add((new Alarm(p, false), p.At));
    }

    public List<Alarm> Due(Place place, AdhanSettings a, DateTimeOffset now)
    {
        var due = new List<Alarm>();
        foreach (var t in _tests.Where(t => now >= t.At).ToList())
        {
            _tests.Remove(t);
            due.Add(t.Alarm);
        }
        if (!a.Enabled) return due;
        var today = place.Today(now);
        var prayers = Schedule.Day(place, today.AddDays(-1)).Concat(Schedule.Day(place, today)).Concat(Schedule.Day(place, today.AddDays(1)))
            .Where(p => p.Prayer != Prayer.Sunrise);
        foreach (var p in prayers)
        {
            if (a.BeforeMinutes > 0) Fire(new Alarm(p, true), p.At.AddMinutes(-a.BeforeMinutes));
            Fire(new Alarm(p, false), p.At);
        }
        return due;

        void Fire(Alarm alarm, DateTimeOffset at)
        {
            if (now < at || now - at > Grace) return;
            if (_fired.Add($"{alarm.Prayer.At:O}|{alarm.Before}")) due.Add(alarm);
        }
    }
}
