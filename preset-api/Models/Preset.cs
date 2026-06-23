namespace PresetApi.Models;

/// <summary>
/// A saved metronome configuration. Mirrors the web client's Preset shape so
/// the JSON lines up 1:1 (System.Text.Json maps PascalCase here to camelCase
/// on the wire by default).
/// </summary>
public class Preset
{
	public string Id { get; set; } = "";
	public string Label { get; set; } = "";
	public int Bpm { get; set; }
	public TimeSignature TimeSignature { get; set; } = new();

	/// <summary>Per-beat emphasis, one per beat: "normal" | "accent" | "muted".</summary>
	public List<string> Pattern { get; set; } = [];

	/// <summary>Epoch milliseconds.</summary>
	public long CreatedAt { get; set; }

	/// <summary>Epoch milliseconds.</summary>
	public long UpdatedAt { get; set; }
}

public class TimeSignature
{
	public int Beats { get; set; }
	public int NoteValue { get; set; }
}
