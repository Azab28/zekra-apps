using Zekra.Core;

namespace Zekra.Tests;

public class AlarmTests
{
    static readonly Place Cairo = ZekraData.Load().Cities.First(c => c.Name == "القاهرة").ToPlace();
    static readonly PrayerTime Asr = Schedule.Day(Cairo, new DateOnly(2026, 10, 8)).Single(t => t.Prayer == Prayer.Asr);

    [Fact]
    public void TheAdhanFiresOnceAtItsTime()
    {
        var alarms = new Alarms();
        var a = new AdhanSettings { BeforeMinutes = 0 };
        Assert.Empty(alarms.Due(Cairo, a, Asr.At.AddSeconds(-1)));
        var due = Assert.Single(alarms.Due(Cairo, a, Asr.At.AddSeconds(1)));
        Assert.Equal(Prayer.Asr, due.Prayer.Prayer);
        Assert.False(due.Before);
        Assert.Empty(alarms.Due(Cairo, a, Asr.At.AddSeconds(3)));
    }

    [Fact]
    public void TheReminderComesMinutesBefore()
    {
        var alarms = new Alarms();
        var due = Assert.Single(alarms.Due(Cairo, new AdhanSettings { BeforeMinutes = 10 }, Asr.At.AddMinutes(-10)));
        Assert.True(due.Before);
        Assert.Equal(Prayer.Asr, due.Prayer.Prayer);
    }

    [Fact]
    public void AnAdhanMissedWhileAsleepIsNotPlayedLate()
    {
        Assert.Empty(new Alarms().Due(Cairo, new AdhanSettings(), Asr.At.Add(Alarms.Grace).AddSeconds(1)));
    }

    [Fact]
    public void SwitchedOffNothingFires()
    {
        Assert.Empty(new Alarms().Due(Cairo, new AdhanSettings { Enabled = false }, Asr.At.AddSeconds(1)));
    }

    [Fact]
    public void TestModeRemindsThenFiresAMinuteLaterEvenWhenSwitchedOff()
    {
        var alarms = new Alarms();
        var now = Asr.At.AddHours(-2);
        alarms.Test(Asr, now);
        var off = new AdhanSettings { Enabled = false };
        Assert.Empty(alarms.Due(Cairo, off, now.AddSeconds(29)));
        Assert.True(Assert.Single(alarms.Due(Cairo, off, now.AddSeconds(30))).Before);
        Assert.Empty(alarms.Due(Cairo, off, now.AddSeconds(59)));
        var adhan = Assert.Single(alarms.Due(Cairo, off, now.AddSeconds(60)));
        Assert.Equal(Prayer.Asr, adhan.Prayer.Prayer);
        Assert.False(adhan.Before);
        Assert.Empty(alarms.Due(Cairo, off, now.AddSeconds(61)));
    }
}
