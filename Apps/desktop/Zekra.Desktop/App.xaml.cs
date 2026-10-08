using System.Net.Http.Json;
using System.Runtime.InteropServices;
using H.NotifyIcon;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.Win32;
using Zekra.Core;

namespace Zekra.Desktop;

public partial class App : Application
{
    public static new App Current => (App)Application.Current;
    public static string IconPath => Path.Combine(AppContext.BaseDirectory, "Assets", "zekra.ico");

    public Settings Settings { get; private set; } = null!;
    public ZekraData Data { get; } = ZekraData.Load();
    public DispatcherQueue Dispatcher { get; private set; } = null!;

    /// <summary>Raised on the UI thread after any setting changes (already saved).</summary>
    public event Action? SettingsChanged;

    readonly string[] _args;
    TaskbarIcon? _tray;
    MainWindow? _main;
    readonly Dictionary<Type, Window> _open = [];
    readonly Alarms _alarms = new();
    AdhanWindow? _alert;
    ZikrWindow? _zikr;
    WidgetWindow? _widget;
    DateTimeOffset _lastZikr = DateTimeOffset.Now;
    string? _lastZikrId;
    MenuFlyoutItem? _stopItem, _updateItem;

    public App(string[] args)
    {
        _args = args;
        InitializeComponent();
        UnhandledException += (_, e) => LogCrash(e.Exception);
        AppDomain.CurrentDomain.UnhandledException += (_, e) => LogCrash(e.ExceptionObject as Exception);
        DispatcherShutdownMode = DispatcherShutdownMode.OnExplicitShutdown;
    }

    protected override void OnLaunched(LaunchActivatedEventArgs e)
    {
        Dispatcher = DispatcherQueue.GetForCurrentThread();
        Settings = Settings.Load();
        ApplyStartup();
        CreateTray();
        _main = new MainWindow();
        // --open settings|azkar|qibla opens that window (handy from a shortcut, and for testing).
        var open = Array.IndexOf(_args, "--open") is var i and >= 0 && i + 1 < _args.Length ? _args[i + 1] : null;
        if (open == "settings") Open<SettingsWindow>();
        else if (open == "azkar") Open<AzkarWindow>();
        else if (open == "qibla") Open<QiblaWindow>();
        else if (!_args.Contains("--tray")) _main.ShowNear(null);
        ListenForSecondCopy();

        ApplyWidget();
        SettingsChanged += ApplyWidget;

        var alarms = Dispatcher.CreateTimer();
        alarms.Interval = TimeSpan.FromSeconds(2);
        alarms.Tick += (_, _) => CheckAlarms();
        alarms.Start();
        AdhanPlayer.Stopped += () => { if (_stopItem is not null) _stopItem.Visibility = Visibility.Collapsed; };
        if (_args.Contains("--test-adhan")) TestAdhan();
        if (_args.Contains("--test-zikr")) ShowZikr();

        var minute = Dispatcher.CreateTimer();
        minute.Interval = TimeSpan.FromSeconds(30);
        minute.Tick += (_, _) => UpdateTooltip();
        minute.Start();
        UpdateTooltip();

        // The account (optional) and the updates.
        Sync.Start();
        Every(TimeSpan.FromMinutes(30), () => _ = Sync.Now(), first: TimeSpan.FromSeconds(5));
        Updater.Ready += () => { if (_updateItem is not null) _updateItem.Visibility = Visibility.Visible; };
        Every(TimeSpan.FromHours(6), () => _ = Updater.CheckAsync(), first: TimeSpan.FromMinutes(1));

        var offset = Dispatcher.CreateTimer();
        offset.Interval = TimeSpan.FromHours(6);
        offset.Tick += (_, _) => _ = RefreshHijriOffset();
        offset.Start();
        _ = RefreshHijriOffset();
    }

    /// <summary>What went wrong, for a bug report: %LOCALAPPDATA%\Zekra\crash.log.</summary>
    static void LogCrash(Exception? ex)
    {
        try
        {
            Directory.CreateDirectory(Settings.Folder);
            File.AppendAllText(Path.Combine(Settings.Folder, "crash.log"), $"{DateTimeOffset.Now:O}\n{ex}\n\n");
        }
        catch (IOException) { }
    }

    /// <summary>Runs `work` after `first`, then every `interval`.</summary>
    void Every(TimeSpan interval, Action work, TimeSpan first)
    {
        var timer = Dispatcher.CreateTimer();
        timer.Interval = first;
        timer.Tick += (_, _) =>
        {
            timer.Interval = interval;
            work();
        };
        timer.Start();
    }

    public void ChangeSettings(Action<Settings> change)
    {
        change(Settings);
        Settings.Save();
        ApplyStartup();
        UpdateTooltip();
        SettingsChanged?.Invoke();
    }

    // --- The adhan ---

    void CheckAlarms()
    {
        var now = DateTimeOffset.Now;
        foreach (var alarm in _alarms.Due(Settings.Place, Settings.Adhan, now)) Ring(alarm);
        if (Settings.Zikr.Enabled && now - _lastZikr >= TimeSpan.FromMinutes(Settings.Zikr.EveryMinutes)) ShowZikr();
    }

    /// <summary>A zikr window now, unless the adhan is up or a full-screen app is in front.</summary>
    public void ShowZikr()
    {
        _lastZikr = DateTimeOffset.Now;
        if (_alert is not null || _zikr is not null || Win.FullScreenBusy()) return;
        if (Settings.Zikr.Pick(Data.Zikr, _lastZikrId, Random.Shared) is not { } zikr) return;
        _lastZikrId = zikr.Id;
        var w = new ZikrWindow(zikr);
        w.Closed += (_, _) => { if (_zikr == w) _zikr = null; };
        _zikr = w;
    }

    void Ring(Alarm alarm)
    {
        var a = Settings.Adhan;
        var sound = !alarm.Before && a.Sound != AdhanSound.Off && !a.Muted.Contains(alarm.Prayer.Prayer);
        if (sound)
        {
            AdhanPlayer.Play(a.Voice, a.Volume, a.Sound == AdhanSound.Short);
            if (_stopItem is not null) _stopItem.Visibility = Visibility.Visible;
        }
        if (Win.FullScreenBusy()) return; // over a full-screen app or a presentation: the sound only
        _alert?.Close();
        _zikr?.Close();
        var w = new AdhanWindow(alarm, sound);
        w.Closed += (_, _) => { if (_alert == w) _alert = null; };
        _alert = w;
    }

    /// <summary>Test mode: the next prayer's adhan, as configured, in a minute.</summary>
    public void TestAdhan() => _alarms.Test(Schedule.Next(Settings.Place, DateTimeOffset.Now), DateTimeOffset.Now);

    // --- The widget on the taskbar ---

    WidgetMode _widgetMode;

    void ApplyWidget()
    {
        if (_widget is not null && _widgetMode == Settings.Widget) { _widget.Refresh(); return; }
        _widget?.Close();
        _widget = null;
        _widgetMode = Settings.Widget;
        if (_widgetMode != WidgetMode.Off) _widget = new WidgetWindow(_widgetMode == WidgetMode.Taskbar);
    }

    /// <summary>Room the floating widget takes above the taskbar, in pixels.</summary>
    public int FloatingWidgetPx => _widget is { OnTaskbar: false } w && w.AppWindow.IsVisible ? w.AppWindow.Size.Height + 6 : 0;

    public void ShowMainNearCursor() => _main?.ShowNear(Win.Cursor());

    // --- Tray ---

    void CreateTray()
    {
        var menu = new MenuFlyout();
        MenuFlyoutItem Item(string text, string glyph, Action click)
        {
            var item = new MenuFlyoutItem { Text = text, Icon = new FontIcon { Glyph = glyph }, FlowDirection = FlowDirection.RightToLeft };
            item.Click += (_, _) => click();
            menu.Items.Add(item);
            return item;
        }
        _stopItem = Item("إيقاف الأذان", "\uE71A", AdhanPlayer.Stop);
        _stopItem.Visibility = Visibility.Collapsed;
        _updateItem = Item("تثبيت التحديث وإعادة التشغيل", "\uE777", Updater.ApplyAndRestart);
        _updateItem.Visibility = Visibility.Collapsed;
        Item("فتح ذِكرى", "\uE80F", () => _main?.ShowNear(null));
        Item("الأذكار", "\uE8F1", Open<AzkarWindow>);
        Item("القبلة", "\uE707", Open<QiblaWindow>);
        Item("الإعدادات", "\uE713", Open<SettingsWindow>);
        menu.Items.Add(new MenuFlyoutSeparator());
        Item("خروج", "\uE7E8", Quit);

        var size = GetSystemMetrics(49); // SM_CXSMICON: the tray's icon size at this DPI
        _tray = new TaskbarIcon
        {
            Icon = new System.Drawing.Icon(IconPath, size, size),
            ToolTipText = "ذِكرى",
            NoLeftClickDelay = true,
            ContextMenuMode = ContextMenuMode.SecondWindow,
            ContextFlyout = menu,
            LeftClickCommand = new Command(() => _main?.Toggle()),
        };
        _tray.ForceCreate(false); // false: no Efficiency Mode, which would delay the adhan's timers
    }

    void UpdateTooltip()
    {
        if (_tray is null) return;
        var now = DateTimeOffset.Now;
        var next = Schedule.Next(Settings.Place, now);
        _tray.ToolTipText = $"ذِكرى — {next.Label} بعد {Schedule.Until(Schedule.MinutesUntil(next.At, now))} ({Schedule.Clock(Settings.Place, next.At)})";
    }

    // --- Windows ---

    /// <summary>One window of each kind: brings it forward if it's already open.</summary>
    public void Open<T>() where T : Window, new()
    {
        if (!_open.TryGetValue(typeof(T), out var w))
        {
            w = new T();
            w.Closed += (_, _) => _open.Remove(typeof(T));
            _open[typeof(T)] = w;
        }
        w.Activate();
    }

    public void Quit()
    {
        AdhanPlayer.Stop();
        _zikr?.Close(); // saves the counts
        _widget?.Close();
        _tray?.Dispose();
        foreach (var w in _open.Values.ToList()) w.Close();
        _main?.CloseForGood();
        Exit();
    }

    void ListenForSecondCopy()
    {
        var show = new EventWaitHandle(false, EventResetMode.AutoReset, Program.ShowEventName);
        new Thread(() =>
        {
            while (show.WaitOne()) Dispatcher.TryEnqueue(() => _main?.ShowNear(null));
        }) { IsBackground = true }.Start();
    }

    // --- Startup with Windows ---

    const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";

    void ApplyStartup() => SetStartup(Settings.StartWithWindows);

    /// <summary>Starts with Windows (in the tray) or not; also cleared by the uninstaller.</summary>
    public static void SetStartup(bool on)
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKey, true);
        if (key is null) return;
        if (on) key.SetValue("Zekra", $"\"{Environment.ProcessPath}\" --tray");
        else key.DeleteValue("Zekra", false);
    }

    // --- The admin's Hijri offset (zekra.site/api/hijri-offset); the last value read is kept ---

    static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(15) };

    async Task RefreshHijriOffset()
    {
        try
        {
            var r = await Http.GetFromJsonAsync<OffsetReply>("https://zekra.site/api/hijri-offset");
            if (r is null) return;
            var offset = Math.Clamp(r.offset, -2, 2); // HIJRI_OFFSET_RANGE in src/lib/hijri.ts
            if (offset != Settings.HijriOffset) ChangeSettings(s => s.HijriOffset = offset);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException) { }
    }

    sealed record OffsetReply(int offset);

    [DllImport("user32.dll")]
    static extern int GetSystemMetrics(int index);
}

sealed class Command(Action run) : System.Windows.Input.ICommand
{
    public event EventHandler? CanExecuteChanged { add { } remove { } }
    public bool CanExecute(object? parameter) => true;
    public void Execute(object? parameter) => run();
}
