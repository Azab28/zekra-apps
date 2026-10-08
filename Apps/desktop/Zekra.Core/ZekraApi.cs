using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Zekra.Core;

/// <summary>The account, optional: its name and the taps not yet sent (Settings.Account).</summary>
public sealed class AccountSettings
{
    /// <summary>Who is signed in (shown in the settings); null when signed out.</summary>
    public string? Name { get; set; }
    /// <summary>The account's tasbeeh total, as last read.</summary>
    public long Total { get; set; }
    /// <summary>Taps counted here and not yet added to the account, with the batch id they go under.</summary>
    public int PendingTaps { get; set; }
    public string? PendingBatch { get; set; }
}

/// <summary>The site's place as /api/me has it (src/lib/site-prefs.ts SitePlace).</summary>
public sealed record ServerPlace(string City, string Timezone, double Latitude, double Longitude, string CalcMethod, Dictionary<string, int>? PrayerAdjust)
{
    /// <summary>This place in the app: the account's city, coordinates, method and minutes; the madhab stays the device's.</summary>
    public Place ToPlace(Place local) => local with
    {
        Name = City,
        Latitude = Latitude,
        Longitude = Longitude,
        TimeZone = Timezone,
        CalcMethod = CalcMethod,
        Adjust = PrayerAdjust is { Count: > 0 } a
            ? a.Where(kv => Enum.TryParse<Prayer>(kv.Key, true, out _)).ToDictionary(kv => Enum.Parse<Prayer>(kv.Key, true), kv => kv.Value)
            : null,
    };

    public bool Same(Place p) =>
        City == p.Name && Timezone == p.TimeZone && CalcMethod == p.CalcMethod &&
        Math.Abs(Latitude - p.Latitude) < 1e-4 && Math.Abs(Longitude - p.Longitude) < 1e-4 &&
        AdjustOf(p).OrderBy(kv => kv.Key).SequenceEqual((PrayerAdjust ?? []).Where(kv => kv.Value != 0).OrderBy(kv => kv.Key));

    /// <summary>The place's minutes as the site writes them ({ "fajr": 2 }).</summary>
    public static Dictionary<string, int> AdjustOf(Place p) =>
        (p.Adjust ?? new Dictionary<Prayer, int>()).Where(kv => kv.Value != 0).ToDictionary(kv => kv.Key.ToString().ToLowerInvariant(), kv => kv.Value);
}

public sealed record Tasbeeh(string? Day, int Today, long Total);
public sealed record ServerPrefs(ServerPlace? Place, Tasbeeh Tasbeeh);
public sealed record ApiUser(long Id, string? Name, string? Username);

/// <summary>A refusal from zekra.site, with its message (already in Arabic).</summary>
public sealed class ApiException(string message, HttpStatusCode status) : Exception(message)
{
    public HttpStatusCode Status { get; } = status;
    public bool SignedOut => Status == HttpStatusCode.Unauthorized;
}

/// <summary>
/// zekra.site's phone-app API (/api/app/auth/*, /api/me with «Authorization: Bearer»). Nothing
/// on the server is specific to this app.
/// </summary>
public sealed class ZekraApi(HttpClient http)
{
    public static readonly Uri Site = new("https://zekra.site");

    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    public string? Token { get; set; }

    public async Task<(string Token, ApiUser User)> SignInWithPassword(string identifier, string password)
    {
        var r = await Post("/api/app/auth/password", new { identifier, password });
        return (r.GetProperty("token").GetString()!, User(r));
    }

    /// <summary>Starts a Telegram sign-in: the link to open (the bot asks «نعم، أنا») and what to poll with.</summary>
    public async Task<(string Link, string Token, string Nonce)> StartTelegram()
    {
        var r = await Post("/api/app/auth/telegram", new { });
        return (r.GetProperty("link").GetString()!, r.GetProperty("token").GetString()!, r.GetProperty("nonce").GetString()!);
    }

    /// <summary>null while it waits for «نعم، أنا»; throws when the link is no longer valid.</summary>
    public async Task<(string Token, ApiUser User)?> PollTelegram(string token, string nonce)
    {
        var r = await Post("/api/app/auth/telegram/poll", new { token, nonce });
        return r.GetProperty("status").GetString() switch
        {
            "ok" => (r.GetProperty("token").GetString()!, User(r)),
            "pending" => null,
            _ => throw new ApiException("انتهت صلاحية طلب الدخول، ابدأ من جديد.", HttpStatusCode.Gone),
        };
    }

    public Task SignOut() => Post("/api/app/auth/logout", new { });

    /// <summary>POST /api/me with a site action ({ type: "get" } and so on); the account's state after it.</summary>
    public async Task<ServerPrefs> Me(object action)
    {
        var r = await Post("/api/me", new { action });
        return r.GetProperty("prefs").Deserialize<ServerPrefs>(Json)!;
    }

    public Task<ServerPrefs> SetPlace(Place p) => Me(new { type = "place", city = p.Name, timezone = p.TimeZone, latitude = p.Latitude, longitude = p.Longitude, calcMethod = p.CalcMethod });

    public Task<ServerPrefs> SetAdjust(Place p) => Me(new { type = "adjust", prayerAdjust = ServerPlace.AdjustOf(p) is { Count: > 0 } a ? a : null });

    /// <summary>Taps under a batch id: sent again after a lost reply, they're added once.</summary>
    public Task<ServerPrefs> AddTaps(int add, string day, string batch) => Me(new { type = "tasbeeh", add, day, batch });

    static ApiUser User(JsonElement r) => r.GetProperty("user").Deserialize<ApiUser>(Json)!;

    async Task<JsonElement> Post(string path, object body)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(Site, path)) { Content = JsonContent.Create(body, options: Json) };
        if (Token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Token);
        using var response = await http.SendAsync(request);
        JsonElement r;
        try
        {
            r = await response.Content.ReadFromJsonAsync<JsonElement>();
        }
        catch (JsonException)
        {
            throw new ApiException("تعذّر الاتصال بموقع ذِكرى، حاول بعد قليل.", response.StatusCode);
        }
        if (response.IsSuccessStatusCode && r.TryGetProperty("ok", out var ok) && ok.GetBoolean()) return r;
        var message = r.ValueKind == JsonValueKind.Object && r.TryGetProperty("error", out var e) && e.GetString() is { } m && m.Any(c => c >= '؀')
            ? m
            : response.StatusCode switch
            {
                HttpStatusCode.Unauthorized => "انتهت جلستك، سجّل الدخول من جديد.",
                HttpStatusCode.TooManyRequests => "محاولات كثيرة، حاول بعد قليل.",
                _ => "تعذّر الاتصال بموقع ذِكرى، حاول بعد قليل.",
            };
        throw new ApiException(message, response.StatusCode);
    }
}
