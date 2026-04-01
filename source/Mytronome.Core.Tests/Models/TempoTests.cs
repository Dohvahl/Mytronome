using Mytronome.Core.Models;

namespace Mytronome.Core.Tests.Models;

public class TempoTests
{
    [Fact]
    public void Constructor_WithValidBpm_CreatesTempo()
    {
        var tempo = new Tempo(120);
        Assert.Equal(120, tempo.Bpm);
    }

    [Theory]
    [InlineData(39)]   // Just below minimum
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(321)]  // Just above maximum
    [InlineData(1000)]
    public void Constructor_WithInvalidBpm_Throws(int bpm)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new Tempo(bpm));
    }

    [Theory]
    [InlineData(40)]   // Minimum boundary
    [InlineData(320)]  // Maximum boundary
    public void Constructor_WithBoundaryBpm_Succeeds(int bpm)
    {
        var tempo = new Tempo(bpm);
        Assert.Equal(bpm, tempo.Bpm);
    }

    [Theory]
    [InlineData(120, 500.0)]    // 60000 / 120 = 500ms
    [InlineData(60, 1000.0)]    // 60000 / 60  = 1000ms
    [InlineData(40, 1500.0)]    // 60000 / 40  = 1500ms
    [InlineData(240, 250.0)]    // 60000 / 240 = 250ms
    public void IntervalMs_CalculatesCorrectly(int bpm, double expectedMs)
    {
        var tempo = new Tempo(bpm);
        Assert.Equal(expectedMs, tempo.IntervalMs);
    }

    [Fact]
    public void Increment_ByDefault_IncreasesBy1()
    {
        var tempo = new Tempo(120);
        var result = tempo.Increment();
        Assert.Equal(121, result.Bpm);
    }

    [Fact]
    public void Increment_WithAmount_IncreasesCorrectly()
    {
        var tempo = new Tempo(120);
        var result = tempo.Increment(10);
        Assert.Equal(130, result.Bpm);
    }

    [Fact]
    public void Increment_AtMaxBpm_ClampsToMax()
    {
        var tempo = new Tempo(Tempo.MaxBpm);
        var result = tempo.Increment();
        Assert.Equal(Tempo.MaxBpm, result.Bpm);
    }

    [Fact]
    public void Decrement_ByDefault_DecreasesBy1()
    {
        var tempo = new Tempo(120);
        var result = tempo.Decrement();
        Assert.Equal(119, result.Bpm);
    }

    [Fact]
    public void Decrement_AtMinBpm_ClampsToMin()
    {
        var tempo = new Tempo(Tempo.MinBpm);
        var result = tempo.Decrement();
        Assert.Equal(Tempo.MinBpm, result.Bpm);
    }

    [Fact]
    public void ToString_ReturnsFormattedString()
    {
        var tempo = new Tempo(120);
        Assert.Equal("120 BPM", tempo.ToString());
    }

    [Fact]
    public void Equality_SameBpm_AreEqual()
    {
        // record structs get value-based equality for free
        var a = new Tempo(120);
        var b = new Tempo(120);
        Assert.Equal(a, b);
    }

    [Fact]
    public void Equality_DifferentBpm_AreNotEqual()
    {
        var a = new Tempo(120);
        var b = new Tempo(121);
        Assert.NotEqual(a, b);
    }
}
