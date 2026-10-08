using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Shapes;
using Zekra.Core;

namespace Zekra.Desktop;

/// <summary>The qibla's bearing from true north and the distance to the Kaaba (src/lib/qibla.ts).</summary>
public sealed partial class QiblaWindow : Window
{
    public QiblaWindow()
    {
        InitializeComponent();
        Win.Setup(this, "القبلة — ذِكرى", 440, 520);
        Win.TitleBar(this, TitleBar);
        LogoHost.Content = Win.Logo(22, Root.ActualTheme);
        Root.ActualThemeChanged += (_, _) => LogoHost.Content = Win.Logo(22, Root.ActualTheme);
        for (var deg = 0; deg < 360; deg += 15)
        {
            var r = deg * Math.PI / 180;
            var (inner, outer) = deg % 90 == 0 ? (118.0, 134.0) : (126.0, 134.0);
            Ticks.Children.Add(new Line
            {
                X1 = 140 + inner * Math.Sin(r), Y1 = 140 - inner * Math.Cos(r),
                X2 = 140 + outer * Math.Sin(r), Y2 = 140 - outer * Math.Cos(r),
                Stroke = Win.Brush("EmeraldBrush", Root), StrokeThickness = deg % 90 == 0 ? 2 : 1, Opacity = 0.6,
            });
        }
        App.Current.SettingsChanged += Show;
        Closed += (_, _) => App.Current.SettingsChanged -= Show;
        Show();
    }

    void Show()
    {
        var p = App.Current.Settings.Place;
        var bearing = Geo.QiblaBearing(p.Latitude, p.Longitude);
        NeedleTurn.Angle = bearing;
        BearingText.Text = $"{Arabic.Digits(Math.Round(bearing))} درجة — {Geo.CompassPoint(bearing)}";
        DistanceText.Text = $"من {p.Name}: {Arabic.Number(Math.Round(Geo.KaabaDistanceKm(p.Latitude, p.Longitude)))} كم إلى الكعبة";
    }
}
