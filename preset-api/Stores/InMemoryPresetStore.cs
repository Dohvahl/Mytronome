using System.Collections.Concurrent;
using PresetApi.Models;

namespace PresetApi.Stores;

/// <summary>
/// Keeps presets in memory only (they are lost when the API restarts).
/// Registered as a singleton, so it is shared across all requests — a
/// ConcurrentDictionary keeps that access thread-safe.
/// </summary>
public class InMemoryPresetStore : IPresetStore
{
	private readonly ConcurrentDictionary<string, Preset> _presets = new();

	public IReadOnlyList<Preset> List() => _presets.Values.ToList();

	public Preset? Get(string id) => _presets.GetValueOrDefault(id);

	public void Save(Preset preset) => _presets[preset.Id] = preset;

	public bool Remove(string id) => _presets.TryRemove(id, out _);
}
