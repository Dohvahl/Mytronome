using PresetApi.Models;

namespace PresetApi.Stores;

/// <summary>
/// The contract for persisting presets on the server. Every operation is scoped
/// to an owner (the authenticated user's id), so users only ever see and modify
/// their own presets.
/// </summary>
public interface IPresetStore
{
    Task<IReadOnlyList<Preset>> ListAsync(string ownerId);
    Task<Preset?> GetAsync(string ownerId, string id);
    Task SaveAsync(string ownerId, Preset preset); // create or overwrite by id
    Task<bool> RemoveAsync(string ownerId, string id);
}
