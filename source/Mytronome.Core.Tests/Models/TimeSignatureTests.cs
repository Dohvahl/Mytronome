using Mytronome.Core.Models;

namespace Mytronome.Core.Tests.Models;

public class TimeSignatureTests
{
    [Fact]
    public void Constructor_WithValidValues_CreatesTimeSignature()
    {
        var ts = new TimeSignature(4, 4);
        Assert.Equal(4, ts.Numerator);
        Assert.Equal(4, ts.Denominator);
    }

    [Fact]
    public void Constructor_WithZeroNumerator_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new TimeSignature(0, 4));
    }

    [Theory]
    [InlineData(3)]   // Not a power of 2
    [InlineData(5)]
    [InlineData(6)]
    [InlineData(7)]
    [InlineData(0)]
    public void Constructor_WithNonPowerOfTwoDenominator_Throws(int denominator)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new TimeSignature(4, denominator));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(4)]
    [InlineData(8)]
    [InlineData(16)]
    public void Constructor_WithPowerOfTwoDenominator_Succeeds(int denominator)
    {
        var ts = new TimeSignature(4, denominator);
        Assert.Equal(denominator, ts.Denominator);
    }

    [Theory]
    [InlineData(4, 4, 4)]   // 4/4 = 4 beats per measure
    [InlineData(3, 4, 3)]   // 3/4 = 3 beats per measure
    [InlineData(6, 8, 6)]   // 6/8 = 6 beats per measure
    public void BeatsPerMeasure_EqualsNumerator(int num, int den, int expected)
    {
        var ts = new TimeSignature(num, den);
        Assert.Equal(expected, ts.BeatsPerMeasure);
    }

    [Fact]
    public void ToString_ReturnsSlashFormat()
    {
        var ts = new TimeSignature(6, 8);
        Assert.Equal("6/8", ts.ToString());
    }

    [Fact]
    public void CommonPresets_ContainsSixEntries()
    {
        Assert.Equal(6, TimeSignature.CommonPresets.Length);
    }

    [Fact]
    public void CommonPresets_FirstIsCommonTime()
    {
        // 4/4 should be the first preset since it's the most common
        var first = TimeSignature.CommonPresets[0];
        Assert.Equal(4, first.Numerator);
        Assert.Equal(4, first.Denominator);
    }

    [Fact]
    public void Equality_SameValues_AreEqual()
    {
        var a = new TimeSignature(3, 4);
        var b = new TimeSignature(3, 4);
        Assert.Equal(a, b);
    }
}
