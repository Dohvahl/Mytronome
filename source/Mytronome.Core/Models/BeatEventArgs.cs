namespace Mytronome.Core.Models;

/// <summary>
/// Event data for each metronome beat tick.
/// Carries the beat position and whether it's an accented downbeat.
/// </summary>
public class BeatEventArgs : EventArgs
{
    /// <summary>
    /// The current beat number within the measure (1-based).
    /// For 4/4 time, this cycles: 1, 2, 3, 4, 1, 2, 3, 4, ...
    /// </summary>
    public required int BeatNumber { get; init; }

    /// <summary>
    /// Total beats per measure (equals the time signature numerator).
    /// </summary>
    public required int TotalBeats { get; init; }

    /// <summary>
    /// True on beat 1 (the downbeat). Used to play the accent click
    /// and highlight the first beat indicator differently.
    /// </summary>
    public required bool IsAccent { get; init; }
}
