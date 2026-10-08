using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using Zekra.Core;

namespace Zekra.Desktop;

/// <summary>
/// The optional zekra.site account: the city follows the account (the site, the bot, the phone
/// app), and the tasbeeh taps counted here are added to it. The session token is kept encrypted
/// for this Windows user (DPAPI) in account.bin, never in settings.json.
/// </summary>
static class Sync
{
    static readonly ZekraApi Api = new(new HttpClient { Timeout = TimeSpan.FromSeconds(20) });
    static readonly SemaphoreSlim OneAtATime = new(1, 1);
    static readonly byte[] Entropy = "zekra-desktop"u8.ToArray();
    static string TokenPath => Path.Combine(Settings.Folder, "account.bin");

    /// <summary>The account's place as last agreed with it: a local change different from it is sent.</summary>
    static ServerPlace? _known;

    public static bool SignedIn => Api.Token is not null;
    /// <summary>The last problem, for the settings page; null when the last sync went well.</summary>
    public static string? Problem { get; private set; }
    /// <summary>Raised on the UI thread when Problem or the signed-in state changes.</summary>
    public static event Action? Changed;

    public static void Start()
    {
        try
        {
            if (File.Exists(TokenPath)) Api.Token = Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(TokenPath), Entropy, DataProtectionScope.CurrentUser));
        }
        catch (CryptographicException)
        {
            File.Delete(TokenPath); // another Windows user's file: sign in again
        }
        App.Current.SettingsChanged += () => _ = PushPlace();
    }

    // --- Signing in and out ---

    public static async Task SignInWithPassword(string identifier, string password)
    {
        var (token, user) = await Api.SignInWithPassword(identifier, password);
        await SignedInAs(token, user);
    }

    /// <summary>Opens the bot in Telegram (it asks «نعم، أنا») and waits for the answer, up to 5 minutes.</summary>
    public static async Task SignInWithTelegram(CancellationToken cancel)
    {
        var (link, token, nonce) = await Api.StartTelegram();
        if (!link.StartsWith("https://t.me/", StringComparison.Ordinal)) throw new ApiException("تعذّر الاتصال بتيليجرام، حاول بعد قليل.", System.Net.HttpStatusCode.BadGateway);
        Process.Start(new ProcessStartInfo(link) { UseShellExecute = true });
        for (var until = DateTime.UtcNow.AddMinutes(5); DateTime.UtcNow < until;)
        {
            await Task.Delay(TimeSpan.FromSeconds(2.5), cancel);
            if (await Api.PollTelegram(token, nonce) is { } done)
            {
                await SignedInAs(done.Token, done.User);
                return;
            }
        }
        throw new ApiException("لم يصل تأكيد الدخول من تيليجرام، ابدأ من جديد.", System.Net.HttpStatusCode.RequestTimeout);
    }

    static async Task SignedInAs(string token, ApiUser user)
    {
        Directory.CreateDirectory(Settings.Folder);
        File.WriteAllBytes(TokenPath, ProtectedData.Protect(Encoding.UTF8.GetBytes(token), Entropy, DataProtectionScope.CurrentUser));
        Api.Token = token;
        App.Current.ChangeSettings(s => s.Account = new AccountSettings { Name = user.Name ?? user.Username ?? "حسابك" });
        await Now();
    }

    public static async Task SignOut()
    {
        try
        {
            await Api.SignOut(); // the session ends everywhere
        }
        catch (Exception ex) when (ex is ApiException or HttpRequestException or TaskCanceledException) { }
        Forget(null);
    }

    static void Forget(string? why)
    {
        File.Delete(TokenPath);
        Api.Token = null;
        _known = null;
        Problem = why;
        App.Current.ChangeSettings(s => s.Account = new AccountSettings());
        Changed?.Invoke();
    }

    // --- Syncing ---

    /// <summary>
    /// The account's city here (or this device's sent there when the account has none), then the
    /// taps not yet sent. At start, every half hour, after signing in, and from «مزامنة الآن».
    /// </summary>
    public static Task Now() => Guarded(async () =>
    {
        var prefs = await Api.Me(new { type = "get" });
        var local = App.Current.Settings.Place;
        if (prefs.Place is null)
        {
            await Api.SetPlace(local);
            prefs = await Api.SetAdjust(local);
        }
        else if (!prefs.Place.Same(local))
        {
            _known = prefs.Place; // set first: the change below isn't sent back
            App.Current.ChangeSettings(s =>
            {
                s.Place = prefs.Place.ToPlace(s.Place);
                s.PlaceFromDevice = false;
            });
        }
        _known = prefs.Place ?? new ServerPlace(local.Name, local.TimeZone, local.Latitude, local.Longitude, local.CalcMethod, ServerPlace.AdjustOf(local));
        await FlushTaps(prefs.Tasbeeh.Total);
    });

    /// <summary>A city or minutes changed here: the account follows.</summary>
    static Task PushPlace()
    {
        var local = App.Current.Settings.Place;
        if (!SignedIn || _known is null || _known.Same(local)) return Task.CompletedTask;
        return Guarded(async () =>
        {
            var prefs = await Api.SetPlace(local);
            prefs = await Api.SetAdjust(local);
            _known = prefs.Place;
        });
    }

    /// <summary>Taps from the zikr window: kept until the account has them.</summary>
    public static void AddTaps(int taps)
    {
        if (!SignedIn || taps <= 0) return;
        var a = App.Current.Settings.Account;
        a.PendingTaps += taps;
        a.PendingBatch ??= Guid.NewGuid().ToString("N");
        App.Current.Settings.Save();
        _ = Guarded(() => FlushTaps(a.Total));
    }

    static async Task FlushTaps(long total)
    {
        var a = App.Current.Settings.Account;
        while (a.PendingTaps > 0)
        {
            var n = Math.Min(a.PendingTaps, 1000); // the most /api/me takes at once
            a.PendingBatch ??= Guid.NewGuid().ToString("N");
            var day = App.Current.Settings.Place.Today(DateTimeOffset.Now).ToString("yyyy-MM-dd");
            total = (await Api.AddTaps(n, day, a.PendingBatch)).Tasbeeh.Total;
            a.PendingTaps -= n;
            a.PendingBatch = null; // the next taps go under a new batch
        }
        App.Current.ChangeSettings(s => s.Account.Total = total);
    }

    /// <summary>One request at a time; an expired session signs out, other problems wait for the next try.</summary>
    static async Task Guarded(Func<Task> work)
    {
        if (!SignedIn) return;
        await OneAtATime.WaitAsync();
        try
        {
            await work();
            Problem = null;
        }
        catch (ApiException ex) when (ex.SignedOut)
        {
            Forget(ex.Message);
            return;
        }
        catch (Exception ex) when (ex is ApiException or HttpRequestException or TaskCanceledException)
        {
            Problem = ex is ApiException ? ex.Message : "تعذّر الاتصال بموقع ذِكرى، ستُعاد المزامنة لاحقًا.";
        }
        finally
        {
            OneAtATime.Release();
        }
        Changed?.Invoke();
    }
}
