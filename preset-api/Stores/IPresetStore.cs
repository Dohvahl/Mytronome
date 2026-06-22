using PresetApi.Models;

namespace PresetApi.Stores;

/// <summary>
/// The contract for persisting presets on the server — the C# counterpart of
/// the web client's PresetStore. Slice 3.2 adds a MySQL-backed implementation;
/// the endpoints depend on this interface, not the concrete store.
/// </summary>
public interface IPresetStore
{
    IReadOnlyList<Preset> List();
    Preset? Get(string id);
    void Save(Preset preset); // create or overwrite by id
    bool Remove(string id);
}
