using System.Collections.Concurrent;
using PresetApi.Models;

#pragma warning disable IDE0130 // Namespace does not match folder structure
namespace PresetApi.Stores;
#pragma warning restore IDE0130 // Namespace does not match folder structure

/// <summary>
/// Keeps presets in memory only (lost when the API restarts). Kept around as a
/// simple reference/test double; the app now registers EfPresetStore instead.
/// A ConcurrentDictionary makes the shared access thread-safe.
/// </summary>
public class InMemoryPresetStore : IPresetStore
{
	private readonly ConcurrentDictionary<string, Preset> _presets = new();

	public Task<IReadOnlyList<Preset>> ListAsync() =>
		Task.FromResult<IReadOnlyList<Preset>>(_presets.Values.ToList());

	public Task<Preset?> GetAsync(string id) =>
		Task.FromResult(_presets.GetValueOrDefault(id));

	public Task SaveAsync(Preset preset)
	{
		_presets[preset.Id] = preset;
		return Task.CompletedTask;
	}

	public Task<bool> RemoveAsync(string id) =>
		Task.FromResult(_presets.TryRemove(id, out _));
}
