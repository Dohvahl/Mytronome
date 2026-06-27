namespace PresetApi.Models;

/// <summary>
/// The client-supplied shape of a preset on create/update. Deliberately distinct
/// from the domain <see cref="Preset"/>. Its reference members are nullable on
/// purpose: JSON that omits a field, or sends an explicit <c>null</c>, then
/// deserializes into a nullable property we can <em>validate</em>, instead of
/// dereferencing a non-null domain property and throwing a NullReferenceException
/// (which would surface as a 500 rather than a 400 validation response).
///
/// <para>
/// Only a fully-validated input is mapped to a domain <see cref="Preset"/> via
/// <see cref="ToPreset"/>. Timestamps are intentionally absent from this contract:
/// the server stamps <c>CreatedAt</c>/<c>UpdatedAt</c> in
/// <see cref="Stores.EfPresetStore"/>, so the client can't influence them.
/// </para>
/// </summary>
public class PresetInput
{
    public string? Id { get; set; }
    public string? Label { get; set; }
    public int Bpm { get; set; }
    public TimeSignatureInput? TimeSignature { get; set; }

    /// <summary>
    /// Per-beat emphasis. The element type is nullable too, so a payload like
    /// <c>["accent", null]</c> deserializes faithfully and the validator can
    /// reject the null entry rather than crashing on it later.
    /// </summary>
    public List<string?>? Pattern { get; set; }

    /// <summary>
    /// Map a <em>validated</em> input to the domain model. Call only after
    /// <see cref="Validation.PresetValidator.Validate"/> has reported no errors.
    /// The null-forgiving operators below rely on that guarantee.
    /// </summary>
    public Preset ToPreset() =>
        new()
        {
            Id = Id!,
            Label = Label!,
            Bpm = Bpm,
            TimeSignature = new TimeSignature
            {
                Beats = TimeSignature!.Beats,
                NoteValue = TimeSignature.NoteValue,
            },
            Pattern = [.. Pattern!.Select(p => p!)],
            // CreatedAt/UpdatedAt are stamped server-side by the store.
        };
}

/// <summary>Nullable-friendly input counterpart of <see cref="TimeSignature"/>.</summary>
public class TimeSignatureInput
{
    public int Beats { get; set; }
    public int NoteValue { get; set; }
}
