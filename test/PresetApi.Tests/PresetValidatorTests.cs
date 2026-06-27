using PresetApi.Models;
using PresetApi.Validation;
using Xunit;

namespace PresetApi.Tests;

public class PresetValidatorTests
{
    private static PresetInput Valid() =>
        new()
        {
            Id = "abc",
            Label = "ok",
            Bpm = 120,
            TimeSignature = new TimeSignatureInput { Beats = 4, NoteValue = 4 },
            Pattern = ["accent", "normal", "normal", "normal"],
        };

    [Fact]
    public void A_valid_preset_has_no_errors()
    {
        Assert.Empty(PresetValidator.Validate(Valid()));
    }

    [Theory]
    [InlineData(39)]
    [InlineData(321)]
    public void Bpm_out_of_range_is_rejected(int bpm)
    {
        var p = Valid();
        p.Bpm = bpm;
        Assert.Contains("bpm", PresetValidator.Validate(p).Keys);
    }

    [Fact]
    public void Unsupported_note_value_is_rejected()
    {
        var p = Valid();
        p.TimeSignature = new TimeSignatureInput { Beats = 4, NoteValue = 5 };
        Assert.Contains("timeSignature", PresetValidator.Validate(p).Keys);
    }

    [Fact]
    public void Pattern_length_must_match_beats()
    {
        var p = Valid();
        p.Pattern = ["accent"]; // length 1, but 4 beats
        Assert.Contains("pattern", PresetValidator.Validate(p).Keys);
    }

    [Fact]
    public void Invalid_emphasis_is_rejected()
    {
        var p = Valid();
        p.Pattern = ["accent", "normal", "normal", "loud"]; // "loud" isn't valid
        Assert.Contains("pattern", PresetValidator.Validate(p).Keys);
    }

    [Fact]
    public void Id_is_required_and_length_capped()
    {
        var missing = Valid();
        missing.Id = "";
        Assert.Contains("id", PresetValidator.Validate(missing).Keys);

        var tooLong = Valid();
        tooLong.Id = new string('x', 65);
        Assert.Contains("id", PresetValidator.Validate(tooLong).Keys);
    }

    // --- Explicit nulls: these used to NRE the validator (a 500); they must now
    // be reported as ordinary validation errors instead. ------------------------

    [Fact]
    public void Null_label_is_rejected()
    {
        var p = Valid();
        p.Label = null;
        Assert.Contains("label", PresetValidator.Validate(p).Keys);
    }

    [Fact]
    public void Null_time_signature_is_rejected()
    {
        var p = Valid();
        p.TimeSignature = null;
        Assert.Contains("timeSignature", PresetValidator.Validate(p).Keys);
    }

    [Fact]
    public void Null_pattern_is_rejected()
    {
        var p = Valid();
        p.Pattern = null;
        Assert.Contains("pattern", PresetValidator.Validate(p).Keys);
    }

    [Fact]
    public void Null_pattern_entry_is_rejected()
    {
        var p = Valid();
        p.Pattern = ["accent", null, "normal", "normal"];
        Assert.Contains("pattern", PresetValidator.Validate(p).Keys);
    }

    [Fact]
    public void Oversized_label_is_rejected()
    {
        var p = Valid();
        p.Label = new string('x', 201); // cap is 200
        Assert.Contains("label", PresetValidator.Validate(p).Keys);
    }

    [Fact]
    public void A_completely_empty_input_is_rejected_without_throwing()
    {
        // Every reference member null (as from a "{}" body) — reports errors, no throw.
        var errors = PresetValidator.Validate(new PresetInput());
        Assert.Contains("id", errors.Keys);
        Assert.Contains("label", errors.Keys);
        Assert.Contains("timeSignature", errors.Keys);
        Assert.Contains("pattern", errors.Keys);
    }
}
