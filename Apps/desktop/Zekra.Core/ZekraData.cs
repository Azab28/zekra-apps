using System.Text.Json;

namespace Zekra.Core;

public sealed record City(string Name, string Country, string Timezone, double Latitude, double Longitude, string CalcMethod)
{
    public Place ToPlace() => new(Name, Latitude, Longitude, Timezone, CalcMethod);
}

public sealed record Method(string Id, string Label);
public sealed record Zikr(string Id, string Text);
public sealed record ZikrItem(string Text, int Repeat);
public sealed record Chapter(int Id, string Title, ZikrItem[] Items);
public sealed record Voice(string Id, string Name);
public sealed record LogoBox(double X, double Y, double W, double H);
/// <summary>src/lib/logo.ts: the green ribbon and the gold crescent and star, with their gradients.</summary>
public sealed record Logo(LogoBox ViewBox, string Green, string Gold, string[] GreenStops, string[] GoldStops);

/// <summary>Data/zekra.json, written on build by tools/export.ts from the site's own files.</summary>
public sealed record ZekraData(
    City[] Cities,
    Method[] Methods,
    Dictionary<string, string> PrayerLabels,
    string[] HijriMonths,
    HijriTable Hijri,
    Zikr[] Zikr,
    Voice[] AdhanVoices,
    string AdhanDua,
    Logo Logo,
    Chapter[] Azkar)
{
    static ZekraData? _data;

    public static ZekraData Load() => _data ??= JsonSerializer.Deserialize<ZekraData>(
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Data", "zekra.json")),
        new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

    public string LabelOf(Prayer p) => PrayerLabels[p.ToString().ToLowerInvariant()];

    public const double NearKm = 400;

    /// <summary>The place for a device location: the nearest listed city when close, else the exact point (the site's placeAt).</summary>
    public Place PlaceAt(double lat, double lng, string deviceZone)
    {
        var near = Cities.MinBy(c => Geo.DistanceKm(lat, lng, c.Latitude, c.Longitude))!;
        var close = Geo.DistanceKm(lat, lng, near.Latitude, near.Longitude) <= NearKm;
        return new(close ? $"{near.Name} (موقعك)" : "موقعك", Math.Round(lat, 4), Math.Round(lng, 4),
            deviceZone, close ? near.CalcMethod : "MuslimWorldLeague");
    }
}

public static class Geo
{
    static double Rad(double d) => d * Math.PI / 180;

    /// <summary>Great-circle distance in km (src/lib/cities.ts distanceKm).</summary>
    public static double DistanceKm(double aLat, double aLng, double bLat, double bLng)
    {
        var h = Math.Pow(Math.Sin(Rad(bLat - aLat) / 2), 2) + Math.Cos(Rad(aLat)) * Math.Cos(Rad(bLat)) * Math.Pow(Math.Sin(Rad(bLng - aLng) / 2), 2);
        return 2 * 6371 * Math.Asin(Math.Sqrt(h));
    }

    static readonly (double Lat, double Lng) Kaaba = (21.422487, 39.826206);

    /// <summary>Degrees clockwise from true north (src/lib/qibla.ts).</summary>
    public static double QiblaBearing(double lat, double lng)
    {
        var φ1 = Rad(lat);
        var Δλ = Rad(Kaaba.Lng - lng);
        var deg = Math.Atan2(Math.Sin(Δλ), Math.Cos(φ1) * Math.Tan(Rad(Kaaba.Lat)) - Math.Sin(φ1) * Math.Cos(Δλ)) * 180 / Math.PI;
        return (deg + 360) % 360;
    }

    public static double KaabaDistanceKm(double lat, double lng) => DistanceKm(lat, lng, Kaaba.Lat, Kaaba.Lng);

    static readonly string[] Points = ["الشمال", "الشمال الشرقي", "الشرق", "الجنوب الشرقي", "الجنوب", "الجنوب الغربي", "الغرب", "الشمال الغربي"];

    public static string CompassPoint(double bearing) => Points[(int)Math.Round((bearing % 360 + 360) % 360 / 45) % 8];
}
