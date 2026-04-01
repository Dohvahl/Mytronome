using Mytronome.Core.Models;

namespace Mytronome.Core.Interfaces;

/// <summary>
/// Contract for persisting metronome presets.
/// Storage-agnostic — implementations can use local files, cloud storage, databases, etc.
/// </summary>
public interface IPresetRepository
{
    Task<IReadOnlyList<MetronomePreset>> GetAllAsync(CancellationToken ct = default);
    Task<MetronomePreset?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task SaveAsync(MetronomePreset preset, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
