namespace Mytronome.Core.Models;

/// <summary>
/// Controls how tempo changes take effect while the metronome is running.
/// </summary>
public enum TempoChangeMode
{
    /// <summary>
    /// New tempo takes effect at the next downbeat (beat 1). No interruption.
    /// </summary>
    Immediate,

    /// <summary>
    /// BPM ramps linearly from the current tempo to the new tempo
    /// over exactly 4 bars. Each bar's BPM is one step closer to the target.
    /// </summary>
    Gradual
}
