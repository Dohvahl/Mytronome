using PresetApi.Models;

namespace PresetApi.Validation;

/// <summary>Server-side validation for incoming presets (never trust the client).</summary>
public static class PresetValidator
{
    private const int MinBpm = 40;
    private const int MaxBpm = 320;
    private const int MaxBeats = 16;
    private const int MaxIdLength = 64;
    private const int MaxLabelLength = 200;
    private static readonly HashSet<int> NoteValues = [1, 2, 4, 8, 16];
    private static readonly HashSet<string> Emphases = ["normal", "accent", "muted"];

    /// <summary>Returns a field->messages map of problems (empty when valid).</summary>
    public static Dictionary<string, string[]> Validate(Preset preset)
    {
        var errors = new Dictionary<string, List<string>>();

        void Add(string field, string message)
        {
            if (!errors.TryGetValue(field, out var list))
                errors[field] = list = [];
            list.Add(message);
        }

        if (string.IsNullOrWhiteSpace(preset.Id) || preset.Id.Length > MaxIdLength)
            Add("id", $"Id is required and must be at most {MaxIdLength} characters.");

        if (preset.Label.Length > MaxLabelLength)
            Add("label", $"Label must be at most {MaxLabelLength} characters.");

        if (preset.Bpm < MinBpm || preset.Bpm > MaxBpm)
            Add("bpm", $"BPM must be between {MinBpm} and {MaxBpm}.");

        if (preset.TimeSignature.Beats < 1 || preset.TimeSignature.Beats > MaxBeats)
            Add("timeSignature", $"Beats must be between 1 and {MaxBeats}.");

        if (!NoteValues.Contains(preset.TimeSignature.NoteValue))
            Add("timeSignature", "Note value must be one of 1, 2, 4, 8, 16.");

        if (preset.Pattern.Count != preset.TimeSignature.Beats)
            Add("pattern", "Pattern length must match the number of beats.");

        if (preset.Pattern.Any(p => !Emphases.Contains(p)))
            Add("pattern", "Pattern values must be 'normal', 'accent', or 'muted'.");

        return errors.ToDictionary(kv => kv.Key, kv => kv.Value.ToArray());
    }
}
