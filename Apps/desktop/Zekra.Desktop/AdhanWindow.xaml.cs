using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using Zekra.Core;

namespace Zekra.Desktop;

/// <summary>
/// The adhan (or the reminder before it) in the screen's corner. It never takes the focus from
/// what the user is doing; App doesn't open it over a full-screen app (the sound still plays).
/// </summary>
public sealed partial class AdhanWindow : Window
{
    readonly DispatcherTimer _close = new();
    readonly bool _before;
    const double Width = 400;

    public AdhanWindow(Alarm alarm, bool withSound)
    {
        InitializeComponent();
        _before = alarm.Before;
        Title = "ذِكرى";
        SystemBackdrop = new MicaBackdrop();
        AppWindow.SetIcon(App.IconPath);
        AppWindow.IsShownInSwitchers = false;
        var presenter = OverlappedPresenter.Create();
        presenter.IsResizable = presenter.IsMaximizable = presenter.IsMinimizable = false;
        presenter.IsAlwaysOnTop = true;
        presenter.SetBorderAndTitleBar(true, false);
        AppWindow.SetPresenter(presenter);

        var app = App.Current;
        var place = app.Settings.Place;
        var p = alarm.Prayer;
        LogoHost.Content = Win.Logo(24, Root.ActualTheme);
        Kicker.Text = $"ذِكرى · {place.Name}";
        if (alarm.Before)
        {
            Heading.Text = $"{p.Label} بعد {Schedule.Until(Schedule.MinutesUntil(p.At, DateTimeOffset.Now))}";
            Detail.Text = $"الأذان عند {Schedule.Clock(place, p.At)}";
            DuaCard.Visibility = StopButton.Visibility = Visibility.Collapsed;
            CloseIn(TimeSpan.FromMinutes(1));
        }
        else
        {
            Heading.Text = $"حان الآن وقت صلاة {p.Label}";
            Detail.Text = $"{Schedule.Clock(place, p.At)} — {Hijri.Label(place.Today(p.At), app.Settings.HijriOffset)}";
            Dua.Text = app.Data.AdhanDua;
            StopButton.Visibility = withSound ? Visibility.Visible : Visibility.Collapsed;
            if (withSound) AdhanPlayer.Stopped += OnSoundStopped;
            else CloseIn(TimeSpan.FromMinutes(5));
        }
        Closed += (_, _) => { AdhanPlayer.Stopped -= OnSoundStopped; _close.Stop(); };
        _close.Tick += (_, _) => Close();

        // As tall as its content, in the screen's corner, shown without taking the focus.
        Root.Measure(new Windows.Foundation.Size(Width, double.PositiveInfinity));
        Win.Resize(this, Width, Root.DesiredSize.Height + 2);
        Win.PlaceNear(this, null);
        AppWindow.Show(false);
        Win.NoActivate(this);
    }

    void CloseIn(TimeSpan after)
    {
        _close.Stop();
        _close.Interval = after;
        _close.Start();
    }

    /// <summary>When the adhan ends: the stop button goes, the dua stays a few minutes.</summary>
    void OnSoundStopped()
    {
        StopButton.Visibility = Visibility.Collapsed;
        CloseIn(TimeSpan.FromMinutes(3));
    }

    void OnStop(object sender, RoutedEventArgs e) => AdhanPlayer.Stop();

    void OnClose(object sender, RoutedEventArgs e)
    {
        if (!_before) AdhanPlayer.Stop();
        Close();
    }
}
