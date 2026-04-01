namespace Mytronome.Core.Models;

/// <summary>
/// Represents a metronome tempo in beats per minute (BPM).
/// Immutable value object that enforces valid BPM range.
/// </summary>
public readonly record struct Tempo
{
    public const int MinBpm = 40;
    public const int MaxBpm = 320;

    public readonly int Bpm { get; }

    public Tempo(int bpm)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(bpm, MinBpm);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(bpm, MaxBpm);
        Bpm = bpm;
    }

    /// <summary>
    /// The interval between beats in milliseconds.
    /// For example, 120 BPM = 500ms between beats.
    /// </summary>
    public double IntervalMs => 60_000.0 / Bpm;

    /// <summary>
    /// Returns a new Tempo increased by the given amount, clamped to the valid range.
    /// </summary>
    public Tempo Increment(int amount = 1) => new(Math.Clamp(Bpm + amount, MinBpm, MaxBpm));

    /// <summary>
    /// Returns a new Tempo decreased by the given amount, clamped to the valid range.
    /// </summary>
    public Tempo Decrement(int amount = 1) => new(Math.Clamp(Bpm - amount, MinBpm, MaxBpm));

    public readonly override string ToString() => $"{Bpm} BPM";
}
