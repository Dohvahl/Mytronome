using Mytronome.Core.Services;

namespace Mytronome.Core.Tests.Services;

public class ClickSampleGeneratorTests
{
    private readonly ClickSampleGenerator _generator = new();

    [Fact]
    public void GenerateClick_ReturnsCorrectBufferSize()
    {
        // 44100 Hz * 30ms / 1000 = 1323 samples * 2 bytes per sample = 2646 bytes
        byte[] buffer = _generator.GenerateClick(1000f, 30, 0.8f);
        int expectedSamples = 44100 * 30 / 1000;
        int expectedBytes = expectedSamples * 2; // 16-bit = 2 bytes per sample
        Assert.Equal(expectedBytes, buffer.Length);
    }

    [Fact]
    public void GenerateClick_WithZeroAmplitude_ReturnsAllZeros()
    {
        byte[] buffer = _generator.GenerateClick(1000f, 20, 0f);
        Assert.All(buffer, b => Assert.Equal(0, b));
    }

    [Fact]
    public void GenerateClick_WithNonZeroAmplitude_ContainsNonZeroData()
    {
        byte[] buffer = _generator.GenerateClick(1000f, 20, 0.8f);
        // At least some bytes should be non-zero (the sine wave has non-zero values)
        Assert.Contains(buffer, b => b != 0);
    }

    [Theory]
    [InlineData(0f)]
    [InlineData(-1f)]
    public void GenerateClick_WithInvalidFrequency_Throws(float frequency)
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => _generator.GenerateClick(frequency, 20, 0.8f));
    }

    [Fact]
    public void GenerateClick_WithInvalidDuration_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => _generator.GenerateClick(1000f, 0, 0.8f));
    }

    [Theory]
    [InlineData(-0.1f)]
    [InlineData(1.1f)]
    public void GenerateClick_WithInvalidAmplitude_Throws(float amplitude)
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => _generator.GenerateClick(1000f, 20, amplitude));
    }

    [Fact]
    public void DefaultProperties_AreStandardAudioValues()
    {
        Assert.Equal(44100, _generator.SampleRate);
        Assert.Equal(16, _generator.BitsPerSample);
        Assert.Equal(1, _generator.Channels);
    }
}
