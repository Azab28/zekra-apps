using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using Zekra.Core;

namespace Zekra.Desktop;

/// <summary>
/// A zikr in the screen's corner with a counter: each tap adds to the phrase's total (kept in the
/// settings). Never takes the focus; hides by itself after a few seconds left alone.
/// </summary>
public sealed partial class ZikrWindow : Window
{
    const double Width = 340;
    readonly DispatcherTimer _tick = new() { Interval = TimeSpan.FromMilliseconds(100) };
    readonly ZikrSettings _settings = App.Current.Settings.Zikr;
    readonly Zikr _zikr;
    DateTime _shownAt = DateTime.UtcNow;
    int _count;

    public ZikrWindow(Zikr zikr)
    {
        InitializeComponent();
        _zikr = zikr;
        Title = "ذِكرى";
        SystemBackdrop = new MicaBackdrop();
        AppWindow.SetIcon(App.IconPath);
        AppWindow.IsShownInSwitchers = false;
        var presenter = OverlappedPresenter.Create();
        presenter.IsResizable = presenter.IsMaximizable = presenter.IsMinimizable = false;
        presenter.IsAlwaysOnTop = true;
        presenter.SetBorderAndTitleBar(true, false);
        AppWindow.SetPresenter(presenter);

        LogoHost.Content = Win.Logo(22, Root.ActualTheme);
        Phrase.Text = zikr.Text;
        ShowTotal();

        // Left alone it hides; the pointer over it holds it.
        _tick.Tick += (_, _) =>
        {
            var left = 1 - (DateTime.UtcNow - _shownAt).TotalSeconds / _settings.StaySeconds;
            if (left <= 0) Close();
            else Left.Value = left;
        };
        Root.PointerEntered += (_, _) => { _tick.Stop(); Left.Value = 1; };
        Root.PointerExited += (_, _) => Restart();
        Closed += (_, _) =>
        {
            _tick.Stop();
            if (_count == 0) return;
            App.Current.Settings.Save();
            Sync.AddTaps(_count); // the account gets them too, when signed in
        };

        Root.Measure(new Windows.Foundation.Size(Width, double.PositiveInfinity));
        Win.Resize(this, Width, Root.DesiredSize.Height + 2);
        Win.PlaceNear(this, null);
        AppWindow.Show(false);
        Win.NoActivate(this);
        Restart();
    }

    void Restart()
    {
        _shownAt = DateTime.UtcNow;
        Left.Value = 1;
        _tick.Start();
    }

    void ShowTotal() =>
        TotalText.Text = $"المجموع: {Arabic.Number(_settings.Totals.GetValueOrDefault(_zikr.Id))}";

    void OnTap(object sender, RoutedEventArgs e)
    {
        _count++;
        _settings.Totals[_zikr.Id] = _settings.Totals.GetValueOrDefault(_zikr.Id) + 1;
        Count.Text = Arabic.Digits(_count);
        ShowTotal();
        Restart();
    }

    void OnClose(object sender, RoutedEventArgs e) => Close();
}
