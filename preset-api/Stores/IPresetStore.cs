using PresetApi.Models;

#pragma warning disable IDE0130 // Namespace does not match folder structure
namespace PresetApi.Stores;
#pragma warning restore IDE0130 // Namespace does not match folder structure

/// <summary>
/// The contract for persisting presets on the server — the C# counterpart of
/// the web client's PresetStore. Async throughout so a database-backed
/// implementation fits without changing the endpoints.
/// </summary>
public interface IPresetStore
{
	Task<IReadOnlyList<Preset>> ListAsync();
	Task<Preset?> GetAsync(string id);
	Task SaveAsync(Preset preset); // create or overwrite by id
	Task<bool> RemoveAsync(string id);
}
