namespace Mytronome.Core.Interfaces;

/// <summary>
/// Contract for playing metronome click sounds.
/// Each platform (CLI/NAudio, MAUI/Plugin.Maui.Audio) provides its own implementation.
/// </summary>
public interface IAudioPlayer : IDisposable
{
    /// <summary>
    /// Initializes the player with pre-generated PCM audio samples.
    /// Called once at startup before any Play methods.
    /// </summary>
    /// <param name="accentSample">Raw PCM bytes for the accented (downbeat) click.</param>
    /// <param name="normalSample">Raw PCM bytes for the regular click.</param>
    /// <param name="sampleRate">Sample rate in Hz (e.g., 44100).</param>
    /// <param name="bitsPerSample">Bits per sample (e.g., 16).</param>
    /// <param name="channels">Number of audio channels (1 = mono).</param>
    void Initialize(byte[] accentSample, byte[] normalSample, int sampleRate, int bitsPerSample, int channels);

    /// <summary>
    /// Plays the accent click sound (for beat 1 / downbeat).
    /// Must be fast — called from the timing thread.
    /// </summary>
    void PlayAccentClick();

    /// <summary>
    /// Plays the normal click sound (for non-accent beats).
    /// Must be fast — called from the timing thread.
    /// </summary>
    void PlayNormalClick();
}
