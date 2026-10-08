using System.Globalization;

namespace Zekra.Core;

public readonly record struct HijriDate(int Year, int Month, int Day);

/// <summary>Where each month starts (epoch days) from Year/Month on, as the site's calendar has it.</summary>
public sealed record HijriTable(int Year, int Month, int[] Starts);

/// <summary>Umm al-Qura dates with the admin's day offset (src/lib/hijri-core.ts).</summary>
public static class Hijri
{
    const int EpochDayNumber = 719162; // 1970-01-01

    /// <summary>The Hijri date of a calendar day, shifted by the offset.</summary>
    public static HijriDate Of(DateOnly day, int offset = 0)
    {
        var d = day.AddDays(offset);
        var t = ZekraData.Load().Hijri;
        var i = Array.BinarySearch(t.Starts, d.DayNumber - EpochDayNumber);
        if (i < 0) i = ~i - 1;
        if (i < 0 || i >= t.Starts.Length - 1)
        {
            // Outside the table (late 1989 to 2100): .NET's own table (the same as the site's between 1420 and 1450 AH).
            var cal = new UmAlQuraCalendar();
            var dt = d.ToDateTime(TimeOnly.MinValue);
            return new(cal.GetYear(dt), cal.GetMonth(dt), cal.GetDayOfMonth(dt));
        }
        var months = t.Month - 1 + i;
        return new(t.Year + months / 12, months % 12 + 1, d.DayNumber - EpochDayNumber - t.Starts[i] + 1);
    }

    /// <summary>«١٧ ربيع الآخر ١٤٤٨ هـ», as the site writes it.</summary>
    public static string Label(DateOnly day, int offset = 0)
    {
        var h = Of(day, offset);
        return $"{Arabic.Digits(h.Day)} {ZekraData.Load().HijriMonths[h.Month - 1]} {Arabic.Digits(h.Year)} هـ";
    }
}

public static class Arabic
{
    /// <summary>Arabic-Indic digits (٠١٢…).</summary>
    public static string Digits(object n) =>
        string.Concat(n.ToString()!.Select(c => c is >= '0' and <= '9' ? (char)('٠' + (c - '0')) : c));

    /// <summary>«١٬٢٣٤»: Arabic digits with the Arabic thousands separator.</summary>
    public static string Number(double n) => Digits(n.ToString("#,0", CultureInfo.InvariantCulture)).Replace(',', '٬');
}
