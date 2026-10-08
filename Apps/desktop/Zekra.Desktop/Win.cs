using System.Runtime.InteropServices;
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Markup;
using Microsoft.UI.Xaml.Media;
using Path = Microsoft.UI.Xaml.Shapes.Path;
using Windows.Graphics;

namespace Zekra.Desktop;

/// <summary>Window plumbing shared by the app's windows (sizes in DIPs, the rest in pixels).</summary>
static class Win
{
    public static IntPtr Hwnd(Window w) => WinRT.Interop.WindowNative.GetWindowHandle(w);

    public static double Scale(Window w) => GetDpiForWindow(Hwnd(w)) / 96.0;

    /// <summary>Mica, the icon, a title, and a size in DIPs: an ordinary app window.</summary>
    public static void Setup(Window w, string title, double width, double height)
    {
        w.Title = title;
        w.SystemBackdrop = new MicaBackdrop();
        w.AppWindow.SetIcon(App.IconPath);
        Resize(w, width, height);
        Center(w);
    }

    /// <summary>Mica under the title too: `bar` is the drag area, kept clear of the caption buttons.</summary>
    public static void TitleBar(Window w, FrameworkElement bar)
    {
        w.ExtendsContentIntoTitleBar = true;
        w.SetTitleBar(bar);
        // Right-to-left: Thickness.Left is the visual right, where the caption buttons are.
        bar.Loaded += (_, _) => bar.Margin = new Thickness(w.AppWindow.TitleBar.RightInset / Scale(w), 0, w.AppWindow.TitleBar.LeftInset / Scale(w), 0);
    }

    public static void Resize(Window w, double width, double height)
    {
        var s = Scale(w);
        w.AppWindow.Resize(new SizeInt32((int)(width * s), (int)(height * s)));
    }

    public static void Center(Window w)
    {
        var area = DisplayArea.GetFromWindowId(w.AppWindow.Id, DisplayAreaFallback.Primary).WorkArea;
        var size = w.AppWindow.Size;
        w.AppWindow.Move(new PointInt32(area.X + (area.Width - size.Width) / 2, area.Y + (area.Height - size.Height) / 2));
    }

    /// <summary>Puts the window in the work-area corner nearest a point (the tray icon's click), else the bottom corner.</summary>
    public static void PlaceNear(Window w, PointInt32? point, int marginPx = 12)
    {
        var p = point ?? new PointInt32(int.MaxValue / 2, int.MaxValue / 2);
        var display = point is null ? DisplayArea.Primary : DisplayArea.GetFromPoint(p, DisplayAreaFallback.Primary);
        var area = display.WorkArea;
        var size = w.AppWindow.Size;
        var right = point is null ? !IsRtlShell() : p.X > area.X + area.Width / 2;
        var bottom = point is null || p.Y > area.Y + area.Height / 2;
        var x = right ? area.X + area.Width - size.Width - marginPx : area.X + marginPx;
        // The corner popups go above the floating widget when it's there.
        var y = bottom ? area.Y + area.Height - size.Height - marginPx - (point is null ? App.Current.FloatingWidgetPx : 0) : area.Y + marginPx;
        w.AppWindow.Move(new PointInt32(x, y));
    }

    /// <summary>Arabic Windows puts the tray on the left.</summary>
    public static bool IsRtlShell() => GetSystemDefaultUILanguage() is var l && (l & 0x3FF) is 0x01 or 0x0D or 0x29 or 0x20;

    public static PointInt32 Cursor() => GetCursorPos(out var p) ? new PointInt32(p.X, p.Y) : default;

    /// <summary>The «ذِكرى» logo from src/lib/logo.ts, `height` DIPs tall.</summary>
    public static FrameworkElement Logo(double height, ElementTheme theme)
    {
        var logo = App.Current.Data.Logo;
        var v = logo.ViewBox;
        // On dark backgrounds the ribbon is lighter (src/components/logo.tsx).
        var green = theme == ElementTheme.Dark ? new[] { "#3fae8c", "#5cc6a2", "#2e9677" } : logo.GreenStops;
        Path Part(string data, string[] stops, Windows.Foundation.Point a, Windows.Foundation.Point b) => new()
        {
            Data = (Geometry)XamlBindingHelper.ConvertValue(typeof(Geometry), "F0 " + data),
            Fill = new LinearGradientBrush
            {
                MappingMode = BrushMappingMode.Absolute,
                StartPoint = a,
                EndPoint = b,
                GradientStops = { Stop(stops[0], 0), Stop(stops[1], 0.48), Stop(stops[2], 1) },
            },
            RenderTransform = new TranslateTransform { X = -v.X, Y = -v.Y },
        };
        var canvas = new Canvas { Width = v.W, Height = v.H };
        canvas.Children.Add(Part(logo.Green, green, new(180, 150), new(1050, 1080)));
        canvas.Children.Add(Part(logo.Gold, logo.GoldStops, new(150, 250), new(1100, 700)));
        return new Viewbox { Height = height, Child = canvas, FlowDirection = FlowDirection.LeftToRight };
    }

    static GradientStop Stop(string hex, double offset) => new() { Color = ColorOf(hex), Offset = offset };

    public static Windows.UI.Color ColorOf(string hex)
    {
        var n = Convert.ToUInt32(hex.TrimStart('#'), 16);
        return ColorHelper.FromArgb(255, (byte)(n >> 16), (byte)(n >> 8), (byte)n);
    }

    /// <summary>One of App.xaml's theme brushes for the element's current theme (code can't use {ThemeResource}).</summary>
    public static Brush Brush(string key, FrameworkElement e) =>
        (Brush)((ResourceDictionary)Application.Current.Resources.ThemeDictionaries[e.ActualTheme == ElementTheme.Dark ? "Dark" : "Light"])[key];

    /// <summary>
    /// Clicks work but the focus stays in the app the user is working in: XAML activates its window
    /// on a click whatever the window styles say, so the focus is handed straight back.
    /// </summary>
    public static void NoActivate(Window w)
    {
        const int GWL_EXSTYLE = -20, WS_EX_NOACTIVATE = 0x08000000, WS_EX_TOOLWINDOW = 0x80;
        var h = Hwnd(w);
        SetWindowLongPtr(h, GWL_EXSTYLE, GetWindowLongPtr(h, GWL_EXSTYLE) | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW);
        TrackOtherApps();
        w.Activated += (_, e) =>
        {
            if (e.WindowActivationState != WindowActivationState.Deactivated && _otherApp != IntPtr.Zero)
                w.DispatcherQueue.TryEnqueue(() => SetForegroundWindow(_otherApp));
        };
    }

    static IntPtr _otherApp;
    static WinEventProc? _onForeground;

    /// <summary>Remembers the last window of another app that had the focus.</summary>
    static void TrackOtherApps()
    {
        if (_onForeground is not null) return;
        _otherApp = GetForegroundWindow();
        _onForeground = (_, _, h, _, _, _, _) =>
        {
            GetWindowThreadProcessId(h, out var pid);
            if (pid != Environment.ProcessId) _otherApp = h;
        };
        const uint EVENT_SYSTEM_FOREGROUND = 3, WINEVENT_OUTOFCONTEXT = 0;
        SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, 0, _onForeground, 0, 0, WINEVENT_OUTOFCONTEXT);
    }

    delegate void WinEventProc(IntPtr hook, uint ev, IntPtr h, int obj, int child, uint thread, uint time);
    [DllImport("user32.dll")] static extern IntPtr SetWinEventHook(uint min, uint max, IntPtr module, WinEventProc proc, uint pid, uint thread, uint flags);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);

    /// <summary>A full-screen app, a game or a presentation is in front: only the sound, no windows.</summary>
    public static bool FullScreenBusy() =>
        SHQueryUserNotificationState(out var state) == 0 && state is 2 or 3 or 4; // QUNS_BUSY, RUNNING_D3D_FULL_SCREEN, PRESENTATION_MODE

    [DllImport("user32.dll")] static extern nint GetWindowLongPtr(IntPtr h, int index);
    [DllImport("user32.dll")] static extern nint SetWindowLongPtr(IntPtr h, int index, nint value);
    [DllImport("shell32.dll")] static extern int SHQueryUserNotificationState(out int state);
    [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);
    [DllImport("kernel32.dll")] static extern ushort GetSystemDefaultUILanguage();
    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }
}
