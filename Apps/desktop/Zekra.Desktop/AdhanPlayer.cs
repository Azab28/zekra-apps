using Microsoft.UI.Dispatching;
using Windows.Media.Core;
using Windows.Media.Playback;
using Zekra.Core;

namespace Zekra.Desktop;

/// <summary>Plays one adhan at a time; «مختصر» stops after 22 s with a 3 s fade, as the extension does.</summary>
static class AdhanPlayer
{
    static readonly TimeSpan ShortLength = TimeSpan.FromSeconds(22), Fade = TimeSpan.FromSeconds(3);
    static MediaPlayer? _player;
    static DispatcherQueueTimer? _fade;

    /// <summary>Raised on the UI thread when the adhan ends or is stopped.</summary>
    public static event Action? Stopped;
    public static bool Playing => _player is not null;

    public static string PathOf(string voice) => Path.Combine(AppContext.BaseDirectory, "Adhan", voice + ".mp3");

    public static void Play(string voice, int volume, bool shortOnly)
    {
        Stop();
        var file = PathOf(voice);
        if (!File.Exists(file)) file = PathOf(App.Current.Data.AdhanVoices[0].Id);
        var level = Math.Clamp(volume, 0, 100) / 100.0;
        var player = new MediaPlayer { Source = MediaSource.CreateFromUri(new Uri(file)), Volume = level };
        var ui = App.Current.Dispatcher;
        player.MediaEnded += (_, _) => ui.TryEnqueue(() => { if (_player == player) Stop(); });
        player.MediaFailed += (_, _) => ui.TryEnqueue(() => { if (_player == player) Stop(); });
        _player = player;
        player.Play();
        if (!shortOnly) return;
        var started = DateTime.UtcNow;
        _fade = ui.CreateTimer();
        _fade.Interval = TimeSpan.FromMilliseconds(100);
        _fade.Tick += (_, _) =>
        {
            var left = ShortLength - (DateTime.UtcNow - started);
            if (left <= TimeSpan.Zero) Stop();
            else if (left < Fade) player.Volume = level * (left / Fade);
        };
        _fade.Start();
    }

    public static void Stop()
    {
        _fade?.Stop();
        _fade = null;
        if (_player is null) return;
        _player.Pause();
        _player.Dispose();
        _player = null;
        Stopped?.Invoke();
    }
}
