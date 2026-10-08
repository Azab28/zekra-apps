using System.Runtime.InteropServices;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using Windows.Graphics;
using Zekra.Core;

namespace Zekra.Desktop;

/// <summary>
/// The next prayer and its countdown by the taskbar's clock. Windows 11 has no API for taskbar
/// widgets and a XAML window can't live inside the taskbar's own window, so «داخل شريط المهام»
/// (experimental) keeps a borderless window over the taskbar's empty space, put back on top every
/// second; the other mode floats as a small bar just above the taskbar.
/// </summary>
public sealed partial class WidgetWindow : Window
{
    public const double Width = 150, Height = 40;
    readonly DispatcherTimer _tick = new() { Interval = TimeSpan.FromSeconds(1) };
    readonly OverlappedPresenter _presenter = OverlappedPresenter.Create();
    PrayerTime? _next;

    /// <summary>Over the taskbar (true) or floating above it.</summary>
    public bool OnTaskbar { get; }

    public WidgetWindow(bool onTaskbar)
    {
        InitializeComponent();
        OnTaskbar = onTaskbar;
        Title = "ذِكرى";
        SystemBackdrop = new DesktopAcrylicBackdrop();
        AppWindow.IsShownInSwitchers = false;
        _presenter.IsResizable = _presenter.IsMaximizable = _presenter.IsMinimizable = false;
        _presenter.IsAlwaysOnTop = true;
        AppWindow.SetPresenter(_presenter);
        _presenter.SetBorderAndTitleBar(!onTaskbar, false); // on the taskbar: no border
        Win.Resize(this, Width, Height);
        Place();
        AppWindow.Show(false);
        if (onTaskbar) NoBorder(Win.Hwnd(this));
        // Shown without taking the focus; a click on it opens the main window, which takes it.

        Root.Tapped += (_, _) => App.Current.ShowMainNearCursor();
        _tick.Tick += (_, _) => Tick();
        _tick.Start();
        Tick();
        Closed += (_, _) => _tick.Stop();
    }

    void Tick()
    {
        var now = DateTimeOffset.Now;
        if (_next is null || _next.At <= now) _next = Schedule.Next(App.Current.Settings.Place, now);
        NameText.Text = $"{_next.Label} {Schedule.Clock(App.Current.Settings.Place, _next.At)}";
        CountdownText.Text = Schedule.Countdown(_next.At - now);
        Place();
    }

    public void Refresh() => _next = null;

    /// <summary>By the clock; hidden over full-screen apps and while an auto-hiding taskbar is down.</summary>
    void Place()
    {
        var taskbar = FindWindow("Shell_TrayWnd", null);
        var tray = FindWindowEx(taskbar, IntPtr.Zero, "TrayNotifyWnd", null);
        RECT bar = default, notify = default;
        if (Win.FullScreenBusy() || !GetWindowRect(taskbar, out bar) || !GetWindowRect(tray, out notify) || !OnScreen(bar))
        {
            if (AppWindow.IsVisible) AppWindow.Hide();
            return;
        }
        var s = Win.Scale(this);
        var size = AppWindow.Size;
        var gap = (int)(8 * s);
        // Arabic Windows puts the clock on the left.
        var clockLeft = notify.Left < bar.Left + (bar.Right - bar.Left) / 2;
        int x, y;
        if (OnTaskbar)
        {
            x = clockLeft ? notify.Right + gap : notify.Left - size.Width - gap;
            y = bar.Top + (bar.Bottom - bar.Top - size.Height) / 2;
        }
        else
        {
            var margin = (int)(12 * s); // as the corner windows above it
            x = clockLeft ? bar.Left + margin : bar.Right - size.Width - margin;
            y = bar.Top - size.Height - (int)(6 * s);
        }
        if (AppWindow.Position.X != x || AppWindow.Position.Y != y) AppWindow.Move(new PointInt32(x, y));
        if (!AppWindow.IsVisible) AppWindow.Show(false);
        // Clicking the taskbar raises it over every other topmost window: come back on top.
        if (OnTaskbar) SetWindowPos(Win.Hwnd(this), new IntPtr(-1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010); // HWND_TOPMOST; NOSIZE | NOMOVE | NOACTIVATE
    }

    /// <summary>An auto-hiding taskbar slides off the screen, all but a pixel or two.</summary>
    static bool OnScreen(RECT r) => DisplayArea.GetFromRect(new RectInt32(r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top), DisplayAreaFallback.None) is { } d
        && Math.Min(r.Bottom, d.OuterBounds.Y + d.OuterBounds.Height) - Math.Max(r.Top, d.OuterBounds.Y) > 8;

    /// <summary>
    /// On the taskbar it reads as part of it: no outline, and no frame. The presenter keeps a dialog
    /// frame in the window's styles whatever it's told, so the frame is given no room instead.
    /// </summary>
    static void NoBorder(IntPtr h)
    {
        const int DWMWA_WINDOW_CORNER_PREFERENCE = 33, DWMWA_BORDER_COLOR = 34;
        var none = 0xFFFFFFFE; // DWMWA_COLOR_NONE
        var small = 3u; // DWMWCP_ROUNDSMALL, like the taskbar's buttons
        DwmSetWindowAttribute(h, DWMWA_BORDER_COLOR, ref none, sizeof(uint));
        DwmSetWindowAttribute(h, DWMWA_WINDOW_CORNER_PREFERENCE, ref small, sizeof(uint));
        SetWindowSubclass(h, NoFrame, 2, 0);
        SetWindowPos(h, IntPtr.Zero, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0004 | 0x0010 | 0x0020); // NOSIZE NOMOVE NOZORDER NOACTIVATE FRAMECHANGED
    }

    const uint WM_NCCALCSIZE = 0x83;
    delegate nint SubclassProc(IntPtr h, uint msg, nint w, nint l, nuint id, nuint data);
    static readonly SubclassProc NoFrame = (h, msg, w, l, id, data) => msg == WM_NCCALCSIZE && w != 0 ? 0 : DefSubclassProc(h, msg, w, l);
    [DllImport("comctl32.dll")] static extern bool SetWindowSubclass(IntPtr h, SubclassProc proc, nuint id, nuint data);
    [DllImport("comctl32.dll")] static extern nint DefSubclassProc(IntPtr h, uint msg, nint w, nint l);

    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr h, int attribute, ref uint value, int size);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindow(string cls, string? title);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string? title);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }
}
