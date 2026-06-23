using System.Collections.Concurrent;
using PresetApi.Models;

namespace PresetApi.Stores;

/// <summary>
/// Keeps presets in memory only (lost when the API restarts). Kept as a simple
/// reference/test double; the app registers EfPresetStore instead. Presets are
/// bucketed per owner so the scoping matches the database-backed store.
/// </summary>
public class InMemoryPresetStore : IPresetStore
{
    private readonly ConcurrentDictionary<
        string,
        ConcurrentDictionary<string, Preset>
    > _byOwner = new();

    private ConcurrentDictionary<string, Preset> Owned(string ownerId) =>
        _byOwner.GetOrAdd(ownerId, _ => new ConcurrentDictionary<string, Preset>());

    public Task<IReadOnlyList<Preset>> ListAsync(string ownerId) =>
        Task.FromResult<IReadOnlyList<Preset>>(Owned(ownerId).Values.ToList());

    public Task<Preset?> GetAsync(string ownerId, string id) =>
        Task.FromResult(Owned(ownerId).GetValueOrDefault(id));

    public Task SaveAsync(string ownerId, Preset preset)
    {
        Owned(ownerId)[preset.Id] = preset;
        return Task.CompletedTask;
    }

    public Task<bool> RemoveAsync(string ownerId, string id) =>
        Task.FromResult(Owned(ownerId).TryRemove(id, out _));
}
