namespace Mytronome.Core.Models;

/// <summary>
/// Identifies which storage backend to use for presets.
/// Used by DI registration to select the correct IPresetRepository implementation.
/// </summary>
public enum StorageType
{
    LocalFile,
    // Future backends:
    // GoogleDrive,
    // Dropbox,
    // SqlDatabase,
}
