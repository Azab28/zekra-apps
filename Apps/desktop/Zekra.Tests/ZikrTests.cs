using Zekra.Core;

namespace Zekra.Tests;

public class ZikrTests
{
    static readonly Zikr[] All = ZekraData.Load().Zikr;

    [Fact]
    public void ThePhrasesComeFromHisnAlMuslim()
    {
        Assert.Equal(9, All.Length);
        Assert.All(All, z => Assert.False(string.IsNullOrWhiteSpace(z.Text)));
    }

    [Fact]
    public void PicksNeitherAnOffPhraseNorTheLastOne()
    {
        var s = new ZikrSettings { Off = All.Skip(2).Select(z => z.Id).ToHashSet() };
        var random = new Random(1);
        for (var i = 0; i < 20; i++) Assert.Equal(All[1].Id, s.Pick(All, All[0].Id, random)!.Id);
    }

    [Fact]
    public void OneLeftIsShownAgainAndNoneLeftIsNothing()
    {
        Assert.Equal(All[0].Id, new ZikrSettings { Off = All.Skip(1).Select(z => z.Id).ToHashSet() }.Pick(All, All[0].Id, new Random())!.Id);
        Assert.Null(new ZikrSettings { Off = All.Select(z => z.Id).ToHashSet() }.Pick(All, null, new Random()));
    }
}
