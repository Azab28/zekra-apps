using System.Text.Json;
using Zekra.Core;

namespace Zekra.Tests;

/// <summary>The app must show exactly what the site shows (fixture from tools/export.ts).</summary>
public class ParityTests
{
    sealed record Row(double lat, double lng, string method, string? madhab, Dictionary<string, int>? adjust, string date, double?[] times);
    sealed record Label(string date, int offset, string label, string hijri);
    sealed record Fixture(Row[] prayers, string hijriFrom, string[] hijri, Label[] labels);

    static readonly Fixture F = JsonSerializer.Deserialize<Fixture>(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixture", "fixture.json")))!;
    static readonly string[] Names = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

    [Fact]
    public void PrayerTimesMatchTheSiteToTheMinute()
    {
        var bad = new List<string>();
        foreach (var r in F.prayers)
        {
            var adjust = r.adjust?.ToDictionary(kv => Enum.Parse<Prayer>(kv.Key, true), kv => kv.Value);
            var place = new Place("", r.lat, r.lng, "UTC", r.method, r.madhab == "hanafi", adjust);
            var got = PrayerCalc.TimesFor(DateOnly.Parse(r.date), place);
            for (var i = 0; i < 6; i++)
            {
                double? g = got[i] is { } t ? t.ToUnixTimeMilliseconds() / 60000.0 : null;
                if (g != r.times[i]) bad.Add($"{r.method}{(r.madhab == "hanafi" ? "/hanafi" : "")} {r.lat},{r.lng} {r.date} {Names[i]}: site {Show(r.times[i])} app {Show(g)}");
            }
        }
        Assert.True(bad.Count == 0, $"{bad.Count} of {F.prayers.Length * 6} differ:\n" + string.Join("\n", bad.Take(40)));
    }

    static string Show(double? m) => m is { } v ? DateTimeOffset.FromUnixTimeMilliseconds((long)(v * 60000)).ToString("yyyy-MM-dd HH:mm:ss") : "none";

    [Fact]
    public void HijriDatesMatchTheSite()
    {
        var day = DateOnly.Parse(F.hijriFrom);
        // Runs of differing days, e.g. "2030-01-04..2030-02-02 (site 1451-8-29, app 1451-9-1)".
        var bad = new List<string>();
        DateOnly? runStart = null;
        var first = "";
        foreach (var want in F.hijri)
        {
            var h = Hijri.Of(day);
            var got = $"{h.Year}-{h.Month}-{h.Day}";
            if (got != want && runStart is null) (runStart, first) = (day, $"site {want}, app {got}");
            if (got == want && runStart is { } s) { bad.Add($"{s:yyyy-MM-dd}..{day.AddDays(-1):yyyy-MM-dd} ({first})"); runStart = null; }
            day = day.AddDays(1);
        }
        if (runStart is { } r) bad.Add($"{r:yyyy-MM-dd}.. ({first})");
        Assert.True(bad.Count == 0, $"{bad.Count} runs of days differ:\n" + string.Join("\n", bad.Take(60)));
    }

    [Fact]
    public void HijriLabelsAndOffsetsMatchTheSite()
    {
        foreach (var l in F.labels)
        {
            var d = DateOnly.Parse(l.date);
            var h = Hijri.Of(d, l.offset);
            Assert.Equal(l.hijri, $"{h.Year}-{h.Month}-{h.Day}");
            Assert.Equal(l.label, Hijri.Label(d, l.offset));
        }
    }
}
