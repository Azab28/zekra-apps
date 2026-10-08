using System.Globalization;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.Devices.Geolocation;
using Zekra.Core;

namespace Zekra.Desktop;

public sealed partial class SettingsWindow : Window
{
    readonly ZekraData _data = App.Current.Data;
    readonly Dictionary<Prayer, NumberBox> _adjust = [];
    readonly Dictionary<Prayer, CheckBox> _muted = [];
    readonly Dictionary<string, CheckBox> _phrases = [];
    static readonly int[] BeforeChoices = [0, 5, 10, 15, 20, 30];
    bool _loading;

    public SettingsWindow()
    {
        InitializeComponent();
        Win.Setup(this, "إعدادات ذِكرى", 720, 760);
        Win.TitleBar(this, TitleBar);
        Root.ActualThemeChanged += (_, _) => LogoHost.Content = Win.Logo(22, Root.ActualTheme);
        LogoHost.Content = Win.Logo(22, Root.ActualTheme);

        CountryBox.ItemsSource = _data.Cities.Select(c => c.Country).Distinct().ToList();
        MethodBox.ItemsSource = _data.Methods;
        foreach (var p in PrayerCalc.All)
        {
            var box = new NumberBox
            {
                Header = _data.LabelOf(p),
                Minimum = -PrayerCalc.MaxAdjustMinutes,
                Maximum = PrayerCalc.MaxAdjustMinutes,
                SmallChange = 1,
                SpinButtonPlacementMode = NumberBoxSpinButtonPlacementMode.Inline,
                Width = 180,
                Margin = new Thickness(0, 0, 0, 8),
            };
            box.ValueChanged += (_, _) => OnAdjust();
            _adjust[p] = box;
            AdjustGrid.Children.Add(box);
        }
        VoiceBox.ItemsSource = _data.AdhanVoices;
        BeforeBox.ItemsSource = BeforeChoices.Select(m => m == 0 ? "بدون" : Schedule.Until(m)).ToList();
        foreach (var p in PrayerCalc.All.Where(p => p != Prayer.Sunrise))
        {
            var box = new CheckBox { Content = _data.LabelOf(p) };
            box.Click += (_, _) => Change(s => { if (box.IsChecked == true) s.Adhan.Muted.Add(p); else s.Adhan.Muted.Remove(p); });
            _muted[p] = box;
            MutedGrid.Children.Add(box);
        }
        EveryBox.ItemsSource = ZikrSettings.EveryChoices.Select(Schedule.Until).ToList();
        StayBox.ItemsSource = ZikrSettings.StayChoices.Select(Seconds).ToList();
        foreach (var z in _data.Zikr)
        {
            var box = new CheckBox { Content = new TextBlock { Text = z.Text, FontFamily = (Microsoft.UI.Xaml.Media.FontFamily)Application.Current.Resources["ZikrFont"], FontSize = 20 } };
            box.Click += (_, _) => Change(s => { if (box.IsChecked == true) s.Zikr.Off.Remove(z.Id); else s.Zikr.Off.Add(z.Id); });
            _phrases[z.Id] = box;
            PhrasesGrid.Children.Add(box);
        }
        AdhanPlayer.Stopped += OnPreviewStopped;
        Sync.Changed += Load;
        Updater.Ready += ShowUpdate;
        VersionText.Text = $"ذِكرى لويندوز، الإصدار {Updater.Version}";
        ShowUpdate();
        Closed += (_, _) =>
        {
            Sync.Changed -= Load;
            Updater.Ready -= ShowUpdate;
            _telegram?.Cancel();
            AdhanPlayer.Stopped -= OnPreviewStopped;
            if (_previewing) AdhanPlayer.Stop();
        };
        Load();
    }

    /// <summary>A country's cities as the site lists them: Egypt's capital first, then by name.</summary>
    List<City> CitiesOf(string country)
    {
        var list = _data.Cities.Where(c => c.Country == country).ToList();
        if (country != "مصر") return list;
        var ar = StringComparer.Create(CultureInfo.GetCultureInfo("ar"), false);
        return [list[0], .. list.Skip(1).OrderBy(c => c.Name, ar)];
    }

    void Load()
    {
        _loading = true;
        var s = App.Current.Settings;
        var place = s.Place;
        var city = s.PlaceFromDevice ? null : _data.Cities.FirstOrDefault(c => c.Name == place.Name);
        CountryBox.SelectedItem = city?.Country;
        CityBox.ItemsSource = city is null ? null : CitiesOf(city.Country).Select(c => c.Name).ToList();
        CityBox.SelectedItem = city?.Name;
        MethodBox.SelectedItem = _data.Methods.FirstOrDefault(m => m.Id == place.CalcMethod);
        MadhabBox.SelectedIndex = place.Hanafi ? 1 : 0;
        foreach (var (p, box) in _adjust) box.Value = place.Adjust?.GetValueOrDefault(p) ?? 0;
        StartupSwitch.IsOn = s.StartWithWindows;
        var a = s.Adhan;
        AdhanSwitch.IsOn = a.Enabled;
        SoundBox.SelectedIndex = (int)a.Sound;
        VoiceBox.SelectedItem = _data.AdhanVoices.FirstOrDefault(v => v.Id == a.Voice) ?? _data.AdhanVoices[0];
        VolumeSlider.Value = a.Volume;
        foreach (var (p, box) in _muted) box.IsChecked = a.Muted.Contains(p);
        BeforeBox.SelectedIndex = Math.Max(0, Array.IndexOf(BeforeChoices, a.BeforeMinutes));
        var z = s.Zikr;
        ZikrSwitch.IsOn = z.Enabled;
        EveryBox.SelectedIndex = Math.Max(0, Array.IndexOf(ZikrSettings.EveryChoices, z.EveryMinutes));
        StayBox.SelectedIndex = Math.Max(0, Array.IndexOf(ZikrSettings.StayChoices, z.StaySeconds));
        foreach (var (id, box) in _phrases) box.IsChecked = !z.Off.Contains(id);
        TotalsText.Text = $"مجموع تسبيحك: {Arabic.Number(z.Totals.Values.Sum())}";
        WidgetBox.SelectedIndex = (int)s.Widget;
        SignedOutPanel.Visibility = Sync.SignedIn ? Visibility.Collapsed : Visibility.Visible;
        SignedInPanel.Visibility = Sync.SignedIn ? Visibility.Visible : Visibility.Collapsed;
        AccountName.Text = $"مسجّل الدخول: {s.Account.Name}";
        AccountTotal.Text = $"تسبيحك في الحساب: {Arabic.Number(s.Account.Total)}" + (s.Account.PendingTaps > 0 ? $" (و{Arabic.Number(s.Account.PendingTaps)} لم تُرسل بعد)" : "");
        AccountProblem.Text = Sync.Problem ?? "";
        AccountProblem.Visibility = Sync.Problem is null ? Visibility.Collapsed : Visibility.Visible;
        WidgetStatus.Text = s.Widget == WidgetMode.Taskbar
            ? "ويندوز لا يتيح للبرامج مكانًا رسميًا في شريط المهام، فهذا الخيار تجريبي: إن غطّى أيقونات أو لم يظهر جيدًا فاختر الشريط الصغير. اضغط عليه لفتح نافذة ذِكرى."
            : "اضغط عليه لفتح نافذة ذِكرى.";
        PlaceSummary.Text = $"{place.Name} — {Arabic.Digits(place.Latitude.ToString("0.####", CultureInfo.InvariantCulture))}، {Arabic.Digits(place.Longitude.ToString("0.####", CultureInfo.InvariantCulture))}";
        _loading = false;
    }

    void Change(Action<Settings> change)
    {
        if (_loading) return;
        App.Current.ChangeSettings(change);
        Load();
    }

    void OnCountry(object sender, SelectionChangedEventArgs e)
    {
        if (_loading || CountryBox.SelectedItem is not string country) return;
        CityBox.ItemsSource = CitiesOf(country).Select(c => c.Name).ToList();
        CityBox.SelectedIndex = 0;
    }

    void OnCity(object sender, SelectionChangedEventArgs e)
    {
        if (CityBox.SelectedItem is not string name || _data.Cities.FirstOrDefault(c => c.Name == name) is not { } city) return;
        // A city brings its time zone, coordinates and usual method; the madhab and the minutes stay.
        Change(s =>
        {
            s.Place = city.ToPlace() with { Hanafi = s.Place.Hanafi, Adjust = s.Place.Adjust };
            s.PlaceFromDevice = false;
        });
    }

    void OnMethod(object sender, SelectionChangedEventArgs e)
    {
        if (MethodBox.SelectedItem is Method m) Change(s => s.Place = s.Place with { CalcMethod = m.Id });
    }

    void OnMadhab(object sender, SelectionChangedEventArgs e) => Change(s => s.Place = s.Place with { Hanafi = MadhabBox.SelectedIndex == 1 });

    void OnAdjust()
    {
        var adjust = _adjust
            .Where(kv => !double.IsNaN(kv.Value.Value) && (int)Math.Round(kv.Value.Value) != 0)
            .ToDictionary(kv => kv.Key, kv => Math.Clamp((int)Math.Round(kv.Value.Value), -PrayerCalc.MaxAdjustMinutes, PrayerCalc.MaxAdjustMinutes));
        Change(s => s.Place = s.Place with { Adjust = adjust.Count > 0 ? adjust : null });
    }

    void OnWidget(object sender, SelectionChangedEventArgs e)
    {
        if (WidgetBox.SelectedIndex >= 0) Change(s => s.Widget = (WidgetMode)WidgetBox.SelectedIndex);
    }

    // --- The account ---

    CancellationTokenSource? _telegram;

    async void OnTelegram(object sender, RoutedEventArgs e)
    {
        _telegram = new CancellationTokenSource();
        WaitingPanel.Visibility = Visibility.Visible;
        TelegramButton.IsEnabled = PasswordButton.IsEnabled = false;
        await Account(() => Sync.SignInWithTelegram(_telegram.Token));
        WaitingPanel.Visibility = Visibility.Collapsed;
        TelegramButton.IsEnabled = PasswordButton.IsEnabled = true;
    }

    void OnCancelTelegram(object sender, RoutedEventArgs e) => _telegram?.Cancel();

    async void OnPassword(object sender, RoutedEventArgs e)
    {
        var who = new TextBox { Header = "اسم المستخدم أو البريد", FlowDirection = FlowDirection.LeftToRight };
        var password = new PasswordBox { Header = "كلمة المرور", FlowDirection = FlowDirection.LeftToRight };
        var dialog = new ContentDialog
        {
            Title = "الدخول باسم المستخدم",
            Content = new StackPanel { Spacing = 12, Width = 320, Children = { who, password } },
            PrimaryButtonText = "دخول",
            CloseButtonText = "إلغاء",
            DefaultButton = ContentDialogButton.Primary,
            FlowDirection = FlowDirection.RightToLeft,
            XamlRoot = Root.XamlRoot,
        };
        if (await dialog.ShowAsync() != ContentDialogResult.Primary) return;
        PasswordButton.IsEnabled = TelegramButton.IsEnabled = false;
        await Account(() => Sync.SignInWithPassword(who.Text.Trim(), password.Password));
        PasswordButton.IsEnabled = TelegramButton.IsEnabled = true;
    }

    async void OnSyncNow(object sender, RoutedEventArgs e) => await Sync.Now();

    async void OnSignOut(object sender, RoutedEventArgs e) => await Account(Sync.SignOut);

    /// <summary>Runs a sign-in or out, showing the site's message when it's refused.</summary>
    async Task Account(Func<Task> work)
    {
        AccountProblem.Visibility = Visibility.Collapsed;
        try
        {
            await work();
        }
        catch (OperationCanceledException) { }
        catch (Exception ex) when (ex is ApiException or HttpRequestException)
        {
            AccountProblem.Text = ex is ApiException ? ex.Message : "تعذّر الاتصال بموقع ذِكرى، حاول بعد قليل.";
            AccountProblem.Visibility = Visibility.Visible;
            return;
        }
        Load();
    }

    // --- Updates ---

    async void OnCheckUpdates(object sender, RoutedEventArgs e)
    {
        CheckButton.IsEnabled = false;
        UpdateStatus.Text = "جارٍ التحقق…";
        UpdateStatus.Text = await Updater.CheckAsync();
        CheckButton.IsEnabled = true;
        ShowUpdate();
    }

    void ShowUpdate()
    {
        RestartButton.Visibility = Updater.ReadyVersion is null ? Visibility.Collapsed : Visibility.Visible;
        if (Updater.ReadyVersion is { } v) UpdateStatus.Text = $"الإصدار {v} جاهز، أعد التشغيل لتثبيته.";
    }

    void OnRestart(object sender, RoutedEventArgs e) => Updater.ApplyAndRestart();

    void OnStartup(object sender, RoutedEventArgs e) => Change(s => s.StartWithWindows = StartupSwitch.IsOn);

    void OnAdhan(object sender, RoutedEventArgs e) => Change(s => s.Adhan.Enabled = AdhanSwitch.IsOn);

    void OnSound(object sender, SelectionChangedEventArgs e)
    {
        if (SoundBox.SelectedIndex >= 0) Change(s => s.Adhan.Sound = (AdhanSound)SoundBox.SelectedIndex);
    }

    void OnVoice(object sender, SelectionChangedEventArgs e)
    {
        if (VoiceBox.SelectedItem is Voice v) Change(s => s.Adhan.Voice = v.Id);
    }

    void OnVolume(object sender, Microsoft.UI.Xaml.Controls.Primitives.RangeBaseValueChangedEventArgs e) =>
        Change(s => s.Adhan.Volume = (int)VolumeSlider.Value);

    void OnBefore(object sender, SelectionChangedEventArgs e)
    {
        if (BeforeBox.SelectedIndex >= 0) Change(s => s.Adhan.BeforeMinutes = BeforeChoices[BeforeBox.SelectedIndex]);
    }

    /// <summary>«٢٠ ثانية», «دقيقة».</summary>
    static string Seconds(int s) => s == 60 ? "دقيقة" : $"{Arabic.Digits(s)} ثانية";

    void OnZikr(object sender, RoutedEventArgs e) => Change(s => s.Zikr.Enabled = ZikrSwitch.IsOn);

    void OnEvery(object sender, SelectionChangedEventArgs e)
    {
        if (EveryBox.SelectedIndex >= 0) Change(s => s.Zikr.EveryMinutes = ZikrSettings.EveryChoices[EveryBox.SelectedIndex]);
    }

    void OnStay(object sender, SelectionChangedEventArgs e)
    {
        if (StayBox.SelectedIndex >= 0) Change(s => s.Zikr.StaySeconds = ZikrSettings.StayChoices[StayBox.SelectedIndex]);
    }

    void OnZikrNow(object sender, RoutedEventArgs e) => App.Current.ShowZikr();

    bool _previewing;

    void OnPreview(object sender, RoutedEventArgs e)
    {
        if (_previewing) { AdhanPlayer.Stop(); return; }
        var a = App.Current.Settings.Adhan;
        AdhanPlayer.Play(a.Voice, a.Volume, true);
        _previewing = true;
        PreviewIcon.Glyph = "\uE71A";
        PreviewText.Text = "إيقاف";
        Microsoft.UI.Xaml.Automation.AutomationProperties.SetName(PreviewButton, "إيقاف");
    }

    void OnPreviewStopped()
    {
        _previewing = false;
        PreviewIcon.Glyph = "\uE768";
        PreviewText.Text = "استمع";
        Microsoft.UI.Xaml.Automation.AutomationProperties.SetName(PreviewButton, "استمع");
    }

    void OnTestAdhan(object sender, RoutedEventArgs e)
    {
        App.Current.TestAdhan();
        TestStatus.Text = $"سيُرفع أذان {Schedule.Next(App.Current.Settings.Place, DateTimeOffset.Now).Label} للتجربة عند {Schedule.Clock(App.Current.Settings.Place, DateTimeOffset.Now.AddMinutes(1))}.";
    }

    async void OnLocate(object sender, RoutedEventArgs e)
    {
        LocateStatus.Visibility = LocationSettingsLink.Visibility = Visibility.Collapsed;
        LocateRing.IsActive = true;
        try
        {
            if (await Geolocator.RequestAccessAsync() != GeolocationAccessStatus.Allowed)
            {
                Fail("لم يُسمح لبرنامج ذِكرى بمعرفة موقع الجهاز. فعّل «السماح لتطبيقات سطح المكتب بالوصول إلى موقعك» في إعدادات ويندوز.", true);
                return;
            }
            var pos = (await new Geolocator { DesiredAccuracy = PositionAccuracy.Default }.GetGeopositionAsync(TimeSpan.FromMinutes(10), TimeSpan.FromSeconds(20))).Coordinate.Point.Position;
            // The device's own time zone is exact for where it is.
            var zone = TimeZoneInfo.TryConvertWindowsIdToIanaId(TimeZoneInfo.Local.Id, out var iana) ? iana : TimeZoneInfo.Local.Id;
            var place = _data.PlaceAt(pos.Latitude, pos.Longitude, zone);
            Change(s =>
            {
                s.Place = place with { Hanafi = s.Place.Hanafi, Adjust = s.Place.Adjust };
                s.PlaceFromDevice = true;
            });
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or TimeoutException or System.Runtime.InteropServices.COMException)
        {
            Fail("تعذّر تحديد الموقع الآن. تأكد أن خدمة الموقع تعمل في ويندوز، أو اختر مدينتك من القائمة.", true);
        }
        finally
        {
            LocateRing.IsActive = false;
        }
    }

    void Fail(string message, bool link)
    {
        LocateStatus.Text = message;
        LocateStatus.Visibility = Visibility.Visible;
        if (link) LocationSettingsLink.Visibility = Visibility.Visible;
    }
}
