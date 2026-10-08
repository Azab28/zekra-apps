using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Windows.Graphics;
using Zekra.Core;

namespace Zekra.Desktop;

/// <summary>The tray's window: the next prayer with a countdown, today's times and dates, and the sections.</summary>
public sealed partial class MainWindow : Window
{
    readonly DispatcherTimer _tick = new() { Interval = TimeSpan.FromSeconds(1) };
    PrayerTime? _next;
    DateTime _hiddenAt;
    bool _closing;
    bool _hadFocus;
    /// <summary>Opened from the tray icon: it closes like a flyout when focus leaves it.</summary>
    bool _flyout;

    public MainWindow()
    {
        InitializeComponent();
        Title = "ذِكرى";
        SystemBackdrop = new MicaBackdrop();
        AppWindow.SetIcon(App.IconPath);
        AppWindow.IsShownInSwitchers = false;
        var presenter = OverlappedPresenter.Create();
        presenter.IsResizable = presenter.IsMaximizable = presenter.IsMinimizable = false;
        presenter.IsAlwaysOnTop = true;
        presenter.SetBorderAndTitleBar(true, false);
        AppWindow.SetPresenter(presenter);
        Win.Resize(this, 360, 540);

        Activated += (_, e) =>
        {
            // Hide when focus moves elsewhere, but only once it had focus (Windows may not give it at once).
            if (e.WindowActivationState != WindowActivationState.Deactivated) _hadFocus = true;
            else if (_hadFocus && _flyout) Hide();
        };
        AppWindow.Closing += (_, e) =>
        {
            if (_closing) return;
            e.Cancel = true;
            Hide();
        };
        var esc = new Microsoft.UI.Xaml.Input.KeyboardAccelerator { Key = Windows.System.VirtualKey.Escape };
        esc.Invoked += (_, e) => { Hide(); e.Handled = true; };
        Root.KeyboardAccelerators.Add(esc);

        _tick.Tick += (_, _) => Tick();
        Root.ActualThemeChanged += (_, _) => { if (AppWindow.IsVisible) Refresh(); };
        App.Current.SettingsChanged += () => { if (AppWindow.IsVisible) Refresh(); };
    }

    public void Toggle()
    {
        // A click on the tray icon first deactivates (hides) the window: don't open it again at once.
        if (AppWindow.IsVisible || (DateTime.UtcNow - _hiddenAt).TotalMilliseconds < 400) Hide();
        else ShowNear(Win.Cursor());
    }

    public void ShowNear(PointInt32? point)
    {
        _flyout = point is not null;
        Refresh();
        Win.PlaceNear(this, point);
        AppWindow.Show();
        Activate();
        _tick.Start();
    }

    void Hide()
    {
        if (!AppWindow.IsVisible) return;
        _hiddenAt = DateTime.UtcNow;
        _hadFocus = false;
        _tick.Stop();
        AppWindow.Hide();
    }

    public void CloseForGood()
    {
        _closing = true;
        Close();
    }

    void Refresh()
    {
        var s = App.Current.Settings;
        var place = s.Place;
        var now = DateTimeOffset.Now;
        var today = place.Today(now);
        LogoHost.Content = Win.Logo(30, Root.ActualTheme);
        PlaceText.Text = place.Name;
        DateText.Text = Schedule.DateLine(today);
        HijriText.Text = Hijri.Label(today, s.HijriOffset);
        _next = Schedule.Next(place, now);
        NextName.Text = _next.Label;
        NextAt.Text = $"عند {Schedule.Clock(place, _next.At)}";

        TimesList.Children.Clear();
        foreach (var t in Schedule.Day(place, today))
        {
            var isNext = t.Prayer == _next.Prayer && place.Today(_next.At) == today;
            var row = new Grid { Padding = new Thickness(12, 9, 12, 9), CornerRadius = new CornerRadius(6) };
            if (isNext) row.Background = Win.Brush("NextRowBrush", Root);
            var name = new TextBlock { Text = t.Label, FontWeight = isNext ? Microsoft.UI.Text.FontWeights.SemiBold : Microsoft.UI.Text.FontWeights.Normal };
            var time = new TextBlock { Text = Schedule.Clock(place, t.At), HorizontalAlignment = HorizontalAlignment.Right };
            if (t.Prayer == Prayer.Sunrise) name.Opacity = time.Opacity = 0.6;
            if (isNext) time.Foreground = Win.Brush("EmeraldBrush", Root);
            row.Children.Add(name);
            row.Children.Add(time);
            TimesList.Children.Add(row);
        }
        Tick();
    }

    void Tick()
    {
        if (_next is null) return;
        var left = _next.At - DateTimeOffset.Now;
        if (left <= TimeSpan.Zero) { Refresh(); return; }
        Countdown.Text = Schedule.Countdown(left);
    }

    void OnAzkar(object sender, RoutedEventArgs e) { Hide(); App.Current.Open<AzkarWindow>(); }
    void OnQibla(object sender, RoutedEventArgs e) { Hide(); App.Current.Open<QiblaWindow>(); }
    void OnSettings(object sender, RoutedEventArgs e) { Hide(); App.Current.Open<SettingsWindow>(); }
}
