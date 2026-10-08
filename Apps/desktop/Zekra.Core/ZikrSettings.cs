namespace Zekra.Core;

/// <summary>The zikr window every so often, with a tasbeeh counter (Settings.Zikr).</summary>
public sealed class ZikrSettings
{
    public static readonly int[] EveryChoices = [15, 30, 60, 120];
    public static readonly int[] StayChoices = [10, 20, 30, 60];

    public bool Enabled { get; set; } = true;
    public int EveryMinutes { get; set; } = 30;
    /// <summary>Seconds the window stays when left alone.</summary>
    public int StaySeconds { get; set; } = 20;
    /// <summary>Phrases (ZekraData.Zikr ids) the user turned off.</summary>
    public HashSet<string> Off { get; set; } = [];
    /// <summary>Taps per phrase, ever.</summary>
    public Dictionary<string, long> Totals { get; set; } = [];

    /// <summary>A phrase that's on, not the one shown last time (when there's a choice).</summary>
    public Zikr? Pick(Zikr[] all, string? last, Random random)
    {
        var on = all.Where(z => !Off.Contains(z.Id)).ToArray();
        var choices = on.Length > 1 ? on.Where(z => z.Id != last).ToArray() : on;
        return choices.Length == 0 ? null : choices[random.Next(choices.Length)];
    }
}
