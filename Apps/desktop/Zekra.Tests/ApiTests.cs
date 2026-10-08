using System.Net;
using System.Text;
using Zekra.Core;

namespace Zekra.Tests;

public class ApiTests
{
    /// <summary>Answers every request with one reply and keeps what was sent.</summary>
    sealed class Stub(HttpStatusCode status, string json) : HttpMessageHandler
    {
        public HttpRequestMessage? Request;
        public string? Body;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Request = request;
            Body = request.Content is null ? null : await request.Content.ReadAsStringAsync(ct);
            return new HttpResponseMessage(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
        }
    }

    [Fact]
    public async Task SignsInWithAPassword()
    {
        var stub = new Stub(HttpStatusCode.OK, """{"ok":true,"token":"t1","user":{"id":5,"name":"علي","username":"ali","telegram":true}}""");
        var (token, user) = await new ZekraApi(new HttpClient(stub)).SignInWithPassword("ali", "secret");
        Assert.Equal("t1", token);
        Assert.Equal("علي", user.Name);
        Assert.Equal("https://zekra.site/api/app/auth/password", stub.Request!.RequestUri!.ToString());
        Assert.Contains("\"identifier\":\"ali\"", stub.Body);
    }

    [Fact]
    public async Task ARefusalCarriesTheSitesMessage()
    {
        var stub = new Stub(HttpStatusCode.Unauthorized, """{"ok":false,"error":"اسم المستخدم أو كلمة المرور غير صحيحة."}""");
        var ex = await Assert.ThrowsAsync<ApiException>(() => new ZekraApi(new HttpClient(stub)).SignInWithPassword("ali", "x"));
        Assert.Equal("اسم المستخدم أو كلمة المرور غير صحيحة.", ex.Message);
    }

    [Fact]
    public async Task AnExpiredTokenMeansSignedOut()
    {
        var stub = new Stub(HttpStatusCode.Unauthorized, """{"ok":false,"error":"unauthorized"}""");
        var ex = await Assert.ThrowsAsync<ApiException>(() => new ZekraApi(new HttpClient(stub)) { Token = "old" }.Me(new { type = "get" }));
        Assert.True(ex.SignedOut);
        Assert.Equal("Bearer old", stub.Request!.Headers.Authorization!.ToString());
    }

    [Fact]
    public async Task TapsGoUnderTheirBatch()
    {
        var stub = new Stub(HttpStatusCode.OK, """{"ok":true,"prefs":{"place":null,"tasbeeh":{"day":"2026-10-08","today":7,"total":120}}}""");
        var prefs = await new ZekraApi(new HttpClient(stub)) { Token = "t" }.AddTaps(7, "2026-10-08", "b1");
        Assert.Equal(120, prefs.Tasbeeh.Total);
        Assert.Contains("\"type\":\"tasbeeh\",\"add\":7,\"day\":\"2026-10-08\",\"batch\":\"b1\"", stub.Body);
    }

    [Fact]
    public void TheAccountsPlaceKeepsTheDevicesMadhab()
    {
        var local = new Place("القاهرة", 30.0444, 31.2357, "Africa/Cairo", "Egyptian", Hanafi: true);
        var server = new ServerPlace("الرياض", "Asia/Riyadh", 24.7136, 46.6753, "UmmAlQura", new() { ["fajr"] = 2 });
        var p = server.ToPlace(local);
        Assert.True(p.Hanafi);
        Assert.Equal(2, p.Adjust![Prayer.Fajr]);
        Assert.True(server.Same(p));
        Assert.False(server.Same(local));
    }
}
