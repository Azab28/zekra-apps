using System.Text.Json;
using Velopack;
using Velopack.Sources;

namespace Zekra.Desktop;

/// <summary>
/// Updates from the public repo of the apps (zekra-apps), whose releases tagged desktop-v* are this
/// app's. An update downloads quietly and is applied on the next start, or at once from the tray
/// menu or the settings.
/// </summary>
static class Updater
{
    /// <summary>The releases repo (.github/workflows/desktop-release.yml publishes there).</summary>
    public const string ReleasesRepo = "https://github.com/Azab28/zekra-apps";

    static UpdateManager? _manager;
    static UpdateInfo? _ready;

    /// <summary>Raised on the UI thread when an update has downloaded.</summary>
    public static event Action? Ready;

    /// <summary>A development build (not installed by the installer) never updates.</summary>
    public static bool Installed => Manager.IsInstalled;
    public static string Version => Manager.CurrentVersion?.ToString() ?? typeof(Updater).Assembly.GetName().Version?.ToString(3) ?? "";
    public static string? ReadyVersion => _ready?.TargetFullRelease.Version.ToString();

    // ZEKRA_UPDATE_URL points at a local folder of packages, for trying an update before releasing it.
    static UpdateManager Manager => _manager ??= Environment.GetEnvironmentVariable("ZEKRA_UPDATE_URL") is { Length: > 0 } local
        ? new UpdateManager(local)
        : new UpdateManager(new AppsRepoSource());

    /// <summary>Checks and downloads; the text says what happened (for the settings page).</summary>
    public static async Task<string> CheckAsync()
    {
        if (!Installed) return "نسخة تطوير: التحديث للنسخة المثبّتة فقط.";
        if (_ready is not null) return $"الإصدار {ReadyVersion} جاهز، أعد تشغيل البرنامج لتثبيته.";
        try
        {
            var update = await Manager.CheckForUpdatesAsync();
            if (update is null) return "لديك أحدث إصدار.";
            await Manager.DownloadUpdatesAsync(update);
            _ready = update;
            App.Current.Dispatcher.TryEnqueue(() => Ready?.Invoke());
            return $"الإصدار {ReadyVersion} جاهز، أعد تشغيل البرنامج لتثبيته.";
        }
        catch (Exception ex) when (ex is HttpRequestException or IOException or TaskCanceledException or InvalidOperationException)
        {
            return "تعذّر التحقق من التحديثات الآن.";
        }
    }

    /// <summary>Installs the downloaded update and starts the new version in the tray.</summary>
    public static void ApplyAndRestart()
    {
        if (_ready is null) return;
        AdhanPlayer.Stop();
        App.Current.Settings.Save();
        Manager.ApplyUpdatesAndRestart(_ready.TargetFullRelease, ["--tray"]);
    }
}

/// <summary>
/// GithubSource skips releases without Velopack's releases.win.json (the other apps'), but reads
/// only the 10 latest, so a few releases of another app would hide this one's: this reads 100.
/// </summary>
// ponytail: the 100 latest releases; page through them if the other apps ever release 100 times between two of ours.
sealed class AppsRepoSource() : GithubSource(Updater.ReleasesRepo, null, false)
{
    protected override async Task<GithubRelease[]> GetReleases(bool includePrereleases)
    {
        var json = await Downloader.DownloadString($"https://api.github.com/repos{RepoUri.AbsolutePath}/releases?per_page=100", GetRequestHeaders("application/vnd.github.v3+json"));
        return (JsonSerializer.Deserialize<GithubRelease[]>(json) ?? [])
            .Where(r => includePrereleases || !r.Prerelease)
            .OrderByDescending(r => r.PublishedAt)
            .ToArray();
    }
}
