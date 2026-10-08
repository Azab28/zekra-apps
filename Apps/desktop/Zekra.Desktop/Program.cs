using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;

namespace Zekra.Desktop;

/// <summary>One copy at a time: starting it again shows the running one's window.</summary>
public static class Program
{
    const string MutexName = "Zekra.Desktop.Single";
    public const string ShowEventName = "Zekra.Desktop.Show";

    [STAThread]
    static int Main(string[] args)
    {
        // The installer's hooks run here and exit; a downloaded update is applied before the app starts.
        Velopack.VelopackApp.Build()
            .OnBeforeUninstallFastCallback(_ => App.SetStartup(false))
            .Run();
        WinRT.ComWrappersSupport.InitializeComWrappers();
        using var mutex = new Mutex(true, MutexName, out var first);
        if (!first)
        {
            if (EventWaitHandle.TryOpenExisting(ShowEventName, out var show)) show.Set();
            return 0;
        }
        Application.Start(p =>
        {
            SynchronizationContext.SetSynchronizationContext(new DispatcherQueueSynchronizationContext(DispatcherQueue.GetForCurrentThread()));
            new App(args);
        });
        return 0;
    }
}
