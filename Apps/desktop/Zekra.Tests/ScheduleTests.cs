using Zekra.Core;

namespace Zekra.Tests;

public class ScheduleTests
{
    static readonly Place Cairo = ZekraData.Load().Cities.First(c => c.Name == "القاهرة").ToPlace();

    [Fact]
    public void AfterIshaTheNextPrayerIsTomorrowsFajr()
    {
        var day = new DateOnly(2026, 10, 8);
        var isha = Schedule.Day(Cairo, day).Single(t => t.Prayer == Prayer.Isha).At;
        var next = Schedule.Next(Cairo, isha.AddMinutes(1));
        Assert.Equal(Prayer.Fajr, next.Prayer);
        Assert.Equal(day.AddDays(1), Cairo.Today(next.At));
    }

    [Fact]
    public void SunriseIsNeverTheNextPrayer()
    {
        var fajr = Schedule.Day(Cairo, new DateOnly(2026, 10, 8)).Single(t => t.Prayer == Prayer.Fajr).At;
        Assert.Equal(Prayer.Dhuhr, Schedule.Next(Cairo, fajr.AddMinutes(1)).Prayer);
    }

    [Fact]
    public void FridayDhuhrIsAlJumuah()
    {
        Assert.Equal("الجمعة", Schedule.Day(Cairo, new DateOnly(2026, 10, 9)).Single(t => t.Prayer == Prayer.Dhuhr).Label);
        Assert.Equal("الظهر", Schedule.Day(Cairo, new DateOnly(2026, 10, 8)).Single(t => t.Prayer == Prayer.Dhuhr).Label);
    }

    [Fact]
    public void TheDayIsThePlacesDay()
    {
        // 23:30 UTC on the 8th is already the 9th in Cairo (UTC+3 in summer time).
        Assert.Equal(new DateOnly(2026, 10, 9), Cairo.Today(new DateTimeOffset(2026, 10, 8, 23, 30, 0, TimeSpan.Zero)));
    }

    [Theory]
    [InlineData(0, "أقل من دقيقة")]
    [InlineData(1, "دقيقة")]
    [InlineData(2, "دقيقتين")]
    [InlineData(10, "١٠ دقائق")]
    [InlineData(11, "١١ دقيقة")]
    [InlineData(125, "ساعتين و٥ دقائق")]
    [InlineData(60 * 11 + 1, "١١ ساعة ودقيقة")]
    public void UntilReadsLikeTheSite(int minutes, string phrase) => Assert.Equal(phrase, Schedule.Until(minutes));

    [Fact]
    public void SettingsRoundTrip()
    {
        Settings.Folder = Path.Combine(Path.GetTempPath(), "zekra-test-" + Guid.NewGuid());
        var s = new Settings { Place = Cairo with { Hanafi = true, Adjust = new Dictionary<Prayer, int> { [Prayer.Fajr] = 2 } }, HijriOffset = -1 };
        s.Save();
        var back = Settings.Load();
        Assert.True(back.Place.Hanafi);
        Assert.Equal(2, back.Place.Adjust![Prayer.Fajr]);
        Assert.Equal(-1, back.HijriOffset);
        Directory.Delete(Settings.Folder, true);
    }
}
