using PresetApi.Models;

namespace PresetApi.Validation;

/// <summary>Server-side validation for incoming presets (never trust the client).</summary>
public static class PresetValidator
{
    // These limits mirror the TS engine (metronome-engine/src/metronome.ts:
    // MIN_BPM / MAX_BPM / MAX_SUBDIVISIONS) and the web's note-value set
    // (web/src/metronome/timeSignatures.ts: NOTE_VALUES). They can't be shared
    // across the TS/C# boundary — keep the two sides in sync by hand.
    private const int MinBpm = 40;
    private const int MaxBpm = 320;
    private const int MaxBeats = 16;
    private const int MaxIdLength = 64;
    private const int MaxLabelLength = 200;
    private static readonly HashSet<int> NoteValues = [1, 2, 4, 8, 16];
    private static readonly HashSet<string> Emphases = ["normal", "accent", "muted"];

    /// <summary>
    /// Validates the raw client input and returns a field->messages map of
    /// problems (empty when valid). Takes the nullable <see cref="PresetInput"/>,
    /// not the domain <see cref="Preset"/>, so that an omitted or explicitly-null
    /// field is reported as a validation error instead of throwing on a null
    /// dereference. Map to the domain model only after this returns no errors.
    /// </summary>
    public static Dictionary<string, string[]> Validate(PresetInput input)
    {
        var errors = new Dictionary<string, List<string>>();

        void Add(string field, string message)
        {
            if (!errors.TryGetValue(field, out var list))
                errors[field] = list = [];
            list.Add(message);
        }

        // IsNullOrWhiteSpace already null-safe, so id needs no separate null check.
        if (string.IsNullOrWhiteSpace(input.Id) || input.Id.Length > MaxIdLength)
            Add("id", $"Id is required and must be at most {MaxIdLength} characters.");

        if (input.Label is null)
            Add("label", "Label is required.");
        else if (input.Label.Length > MaxLabelLength)
            Add("label", $"Label must be at most {MaxLabelLength} characters.");

        if (input.Bpm < MinBpm || input.Bpm > MaxBpm)
            Add("bpm", $"BPM must be between {MinBpm} and {MaxBpm}.");

        if (input.TimeSignature is null)
        {
            Add("timeSignature", "Time signature is required.");
        }
        else
        {
            if (input.TimeSignature.Beats < 1 || input.TimeSignature.Beats > MaxBeats)
                Add("timeSignature", $"Beats must be between 1 and {MaxBeats}.");

            if (!NoteValues.Contains(input.TimeSignature.NoteValue))
                Add("timeSignature", "Note value must be one of 1, 2, 4, 8, 16.");
        }

        if (input.Pattern is null)
        {
            Add("pattern", "Pattern is required.");
        }
        else
        {
            // The length must match the beat count, but that's only meaningful
            // when a time signature was actually supplied.
            if (input.TimeSignature is not null
                && input.Pattern.Count != input.TimeSignature.Beats)
                Add("pattern", "Pattern length must match the number of beats.");

            // A null or unrecognized entry (e.g. ["accent", null] or ["loud"]).
            if (input.Pattern.Any(p => p is null || !Emphases.Contains(p)))
                Add("pattern", "Pattern values must be 'normal', 'accent', or 'muted'.");
        }

        return errors.ToDictionary(kv => kv.Key, kv => kv.Value.ToArray());
    }
}
