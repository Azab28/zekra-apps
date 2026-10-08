using System.Text.Json;
using System.Text.Json.Serialization;

namespace Zekra.Core;

/// <summary>The next prayer on the taskbar: inside it (experimental, floats when that fails) or floating above it.</summary>
public enum WidgetMode { Off, Taskbar, Floating }

/// <summary>Everything the user picks, kept in %LOCALAPPDATA%\Zekra\settings.json.</summary>
public sealed class Settings
{
    public Place Place { get; set; } = ZekraData.Load().Cities[0].ToPlace();
    /// <summary>The place came from the device's location (its time zone is the device's).</summary>
    public bool PlaceFromDevice { get; set; }
    public bool StartWithWindows { get; set; } = true;
    public AdhanSettings Adhan { get; set; } = new();
    public ZikrSettings Zikr { get; set; } = new();
    public WidgetMode Widget { get; set; } = WidgetMode.Off;
    public AccountSettings Account { get; set; } = new();

    /// <summary>The admin's Hijri day offset, last read from zekra.site.</summary>
    public int HijriOffset { get; set; }

    public static string Folder { get; set; } = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Zekra");
    static string FilePath => Path.Combine(Folder, "settings.json");

    static readonly JsonSerializerOptions Json = new()
    {
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter() },
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping, // Arabic stays readable in the file
    };

    public static Settings Load()
    {
        try
        {
            if (File.Exists(FilePath)) return JsonSerializer.Deserialize<Settings>(File.ReadAllText(FilePath), Json) ?? new();
        }
        catch (JsonException) { } // a broken file starts over rather than keeping the app from opening
        return new();
    }

    public void Save()
    {
        Directory.CreateDirectory(Folder);
        var tmp = FilePath + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(this, Json));
        File.Move(tmp, FilePath, true);
    }
}
