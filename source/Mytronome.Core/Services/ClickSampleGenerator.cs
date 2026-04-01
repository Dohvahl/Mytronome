using Mytronome.Core.Interfaces;

namespace Mytronome.Core.Services;

/// <summary>
/// Generates raw PCM audio samples for metronome clicks using sine wave synthesis.
/// No external audio files needed — pure math.
/// </summary>
public class ClickSampleGenerator : IClickSampleProvider
{
    public int SampleRate { get; } = 44100;
    public int BitsPerSample { get; } = 16;
    public int Channels { get; } = 1;

    /// <summary>
    /// Generates a short sine wave tone as raw 16-bit PCM bytes.
    /// Includes a fade-out envelope to prevent audible popping artifacts.
    /// </summary>
    public byte[] GenerateClick(float frequencyHz, int durationMs, float amplitude)
    {
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(frequencyHz, 0);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(durationMs, 0);
        ArgumentOutOfRangeException.ThrowIfLessThan(amplitude, 0f);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(amplitude, 1f);

        int totalSamples = SampleRate * durationMs / 1000;
        // 2 bytes per sample for 16-bit audio
        byte[] buffer = new byte[totalSamples * 2];

        // Fade out the last 20% of samples to avoid a pop when the tone ends abruptly
        int fadeStartSample = (int)(totalSamples * 0.8);

        for (int i = 0; i < totalSamples; i++)
        {
            // Sine wave: sin(2π × frequency × sampleIndex / sampleRate)
            double sineValue = Math.Sin(2.0 * Math.PI * frequencyHz * i / SampleRate);

            // Apply fade-out envelope for the last 20% of the tone
            double envelope = 1.0;
            if (i >= fadeStartSample)
            {
                // Linear fade from 1.0 to 0.0 over the fade region
                envelope = 1.0 - (double)(i - fadeStartSample) / (totalSamples - fadeStartSample);
            }

            // Scale to 16-bit signed range (-32768 to 32767)
            short sample = (short)(sineValue * amplitude * envelope * short.MaxValue);

            // Convert to bytes (little-endian, which is standard for PCM)
            buffer[i * 2] = (byte)(sample & 0xFF);         // low byte
            buffer[i * 2 + 1] = (byte)((sample >> 8) & 0xFF); // high byte
        }

        return buffer;
    }
}
