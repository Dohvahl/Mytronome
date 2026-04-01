namespace Mytronome.Core.Models;

/// <summary>
/// A saved metronome configuration with a user-defined label.
/// This is an entity identified by its Id, not a value object.
/// </summary>
public class MetronomePreset
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Label { get; set; }
    public int Bpm { get; set; }
    public int TimeSignatureNumerator { get; set; }
    public int TimeSignatureDenominator { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Convenience method to create a Tempo value object from the stored BPM.
    /// </summary>
    public Tempo ToTempo() => new(Bpm);

    /// <summary>
    /// Convenience method to create a TimeSignature value object from the stored values.
    /// </summary>
    public TimeSignature ToTimeSignature() => new(TimeSignatureNumerator, TimeSignatureDenominator);
}
