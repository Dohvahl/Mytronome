using PresetApi.Models;
using PresetApi.Validation;
using Xunit;

namespace PresetApi.Tests;

public class PresetValidatorTests
{
    private static Preset Valid() =>
        new()
        {
            Id = "abc",
            Label = "ok",
            Bpm = 120,
            TimeSignature = new TimeSignature { Beats = 4, NoteValue = 4 },
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
        p.TimeSignature = new TimeSignature { Beats = 4, NoteValue = 5 };
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
}
