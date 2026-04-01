namespace Mytronome.Core.Interfaces;

/// <summary>
/// Contract for generating raw PCM audio samples for metronome clicks.
/// The generation is platform-independent (pure math); only playback is platform-specific.
/// </summary>
public interface IClickSampleProvider
{
    /// <summary>
    /// Generates a raw PCM audio buffer containing a click/tone.
    /// </summary>
    /// <param name="frequencyHz">Frequency of the tone in Hz (e.g., 1000 for accent, 800 for normal).</param>
    /// <param name="durationMs">Duration of the click in milliseconds (e.g., 30).</param>
    /// <param name="amplitude">Volume from 0.0 (silent) to 1.0 (full volume).</param>
    /// <returns>Raw PCM audio bytes (16-bit signed, mono).</returns>
    byte[] GenerateClick(float frequencyHz, int durationMs, float amplitude);

    int SampleRate { get; }
    int BitsPerSample { get; }
    int Channels { get; }
}
