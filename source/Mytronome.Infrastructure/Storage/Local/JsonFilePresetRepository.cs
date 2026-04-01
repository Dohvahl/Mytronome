using System.Text.Json;
using Mytronome.Core.Interfaces;
using Mytronome.Core.Json;
using Mytronome.Core.Models;

namespace Mytronome.Infrastructure.Storage.Local;

/// <summary>
/// Stores metronome presets as a JSON file on the local filesystem.
/// Uses atomic writes (write to temp file, then rename) to prevent corruption.
/// Thread-safe via SemaphoreSlim.
/// </summary>
public class JsonFilePresetRepository : IPresetRepository
{
    private readonly string _filePath;
    private readonly SemaphoreSlim _lock = new(1, 1);

    /// <summary>
    /// Creates a repository that stores presets at the given file path.
    /// The directory will be created if it doesn't exist.
    /// </summary>
    public JsonFilePresetRepository(string filePath)
    {
        _filePath = filePath;
    }

    /// <summary>
    /// Creates a repository using the default location:
    /// %APPDATA%/Mytronome/presets.json on Windows.
    /// </summary>
    public JsonFilePresetRepository()
        : this(GetDefaultFilePath())
    {
    }

    public async Task<IReadOnlyList<MetronomePreset>> GetAllAsync(CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            return await ReadPresetsAsync(ct);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<MetronomePreset?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var presets = await GetAllAsync(ct);
        return presets.FirstOrDefault(p => p.Id == id);
    }

    /// <summary>
    /// Saves a preset. If a preset with the same Id exists, it's updated in place (upsert).
    /// Otherwise, a new entry is added.
    /// </summary>
    public async Task SaveAsync(MetronomePreset preset, CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            var presets = await ReadPresetsAsync(ct);
            var mutableList = presets.ToList();

            // Look for an existing preset with the same Id to update
            int existingIndex = mutableList.FindIndex(p => p.Id == preset.Id);
            if (existingIndex >= 0)
            {
                preset.UpdatedAt = DateTime.UtcNow;
                mutableList[existingIndex] = preset;
            }
            else
            {
                preset.CreatedAt = DateTime.UtcNow;
                preset.UpdatedAt = DateTime.UtcNow;
                mutableList.Add(preset);
            }

            await WritePresetsAsync(mutableList, ct);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            var presets = await ReadPresetsAsync(ct);
            var mutableList = presets.Where(p => p.Id != id).ToList();
            await WritePresetsAsync(mutableList, ct);
        }
        finally
        {
            _lock.Release();
        }
    }

    /// <summary>
    /// Reads all presets from the JSON file. Returns empty list if file doesn't exist.
    /// </summary>
    private async Task<IReadOnlyList<MetronomePreset>> ReadPresetsAsync(CancellationToken ct)
    {
        if (!File.Exists(_filePath))
            return [];

        await using var stream = File.OpenRead(_filePath);
        var presets = await JsonSerializer.DeserializeAsync(
            stream,
            MytronomeJsonContext.Default.ListMetronomePreset,
            ct);

        return presets ?? [];
    }

    /// <summary>
    /// Writes presets to disk using atomic write (temp file + rename).
    /// This prevents data corruption if the process crashes mid-write.
    /// </summary>
    private async Task WritePresetsAsync(List<MetronomePreset> presets, CancellationToken ct)
    {
        // Ensure the directory exists
        string? directory = Path.GetDirectoryName(_filePath);
        if (directory is not null)
            Directory.CreateDirectory(directory);

        // Write to a temp file first, then rename (atomic on most filesystems)
        string tempPath = _filePath + ".tmp";
        await using (var stream = File.Create(tempPath))
        {
            await JsonSerializer.SerializeAsync(
                stream,
                presets,
                MytronomeJsonContext.Default.ListMetronomePreset,
                ct);
        }

        File.Move(tempPath, _filePath, overwrite: true);
    }

    private static string GetDefaultFilePath()
    {
        string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(appData, "Mytronome", "presets.json");
    }
}
