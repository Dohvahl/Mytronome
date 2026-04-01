using Mytronome.Core.Models;
using Mytronome.Infrastructure.Storage.Local;

namespace Mytronome.Core.Tests.Infrastructure;

/// <summary>
/// Integration tests for JsonFilePresetRepository.
/// Uses a temporary directory that's cleaned up after each test.
/// </summary>
public class JsonFilePresetRepositoryTests : IDisposable
{
    private readonly string _tempDir;
    private readonly string _filePath;
    private readonly JsonFilePresetRepository _repo;

    public JsonFilePresetRepositoryTests()
    {
        // Create a unique temp directory for each test to avoid interference
        _tempDir = Path.Combine(Path.GetTempPath(), "mytronome-tests", Guid.NewGuid().ToString());
        _filePath = Path.Combine(_tempDir, "presets.json");
        _repo = new JsonFilePresetRepository(_filePath);
    }

    public void Dispose()
    {
        // Clean up temp directory after test completes
        if (Directory.Exists(_tempDir))
            Directory.Delete(_tempDir, recursive: true);
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task GetAllAsync_WhenFileDoesNotExist_ReturnsEmptyList()
    {
        var presets = await _repo.GetAllAsync();
        Assert.Empty(presets);
    }

    [Fact]
    public async Task SaveAsync_ThenGetAllAsync_ReturnsPreset()
    {
        var preset = CreatePreset("Warmup", 100, 4, 4);

        await _repo.SaveAsync(preset);
        var result = await _repo.GetAllAsync();

        Assert.Single(result);
        Assert.Equal("Warmup", result[0].Label);
        Assert.Equal(100, result[0].Bpm);
    }

    [Fact]
    public async Task SaveAsync_MultipleTimes_AccumulatesPresets()
    {
        await _repo.SaveAsync(CreatePreset("Slow", 60, 4, 4));
        await _repo.SaveAsync(CreatePreset("Fast", 200, 4, 4));

        var result = await _repo.GetAllAsync();
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task SaveAsync_WithExistingId_UpdatesInPlace()
    {
        // This tests the "update without delete" requirement
        var preset = CreatePreset("Original", 100, 4, 4);
        await _repo.SaveAsync(preset);

        // Modify and save again with the same Id
        preset.Label = "Updated";
        preset.Bpm = 140;
        await _repo.SaveAsync(preset);

        var result = await _repo.GetAllAsync();
        Assert.Single(result); // Should still be one preset, not two
        Assert.Equal("Updated", result[0].Label);
        Assert.Equal(140, result[0].Bpm);
    }

    [Fact]
    public async Task GetByIdAsync_WithExistingId_ReturnsPreset()
    {
        var preset = CreatePreset("Target", 120, 3, 4);
        await _repo.SaveAsync(preset);

        var result = await _repo.GetByIdAsync(preset.Id);

        Assert.NotNull(result);
        Assert.Equal("Target", result.Label);
    }

    [Fact]
    public async Task GetByIdAsync_WithNonExistingId_ReturnsNull()
    {
        var result = await _repo.GetByIdAsync(Guid.NewGuid());
        Assert.Null(result);
    }

    [Fact]
    public async Task DeleteAsync_RemovesPreset()
    {
        var preset = CreatePreset("ToDelete", 100, 4, 4);
        await _repo.SaveAsync(preset);

        await _repo.DeleteAsync(preset.Id);

        var result = await _repo.GetAllAsync();
        Assert.Empty(result);
    }

    [Fact]
    public async Task DeleteAsync_WithNonExistingId_DoesNothing()
    {
        await _repo.SaveAsync(CreatePreset("Keep", 100, 4, 4));

        await _repo.DeleteAsync(Guid.NewGuid()); // Delete a non-existing Id

        var result = await _repo.GetAllAsync();
        Assert.Single(result);
    }

    [Fact]
    public async Task SaveAsync_PreservesAllFields()
    {
        var preset = new MetronomePreset
        {
            Label = "Full Test",
            Bpm = 180,
            TimeSignatureNumerator = 6,
            TimeSignatureDenominator = 8,
        };

        await _repo.SaveAsync(preset);
        var result = (await _repo.GetAllAsync())[0];

        Assert.Equal(preset.Id, result.Id);
        Assert.Equal("Full Test", result.Label);
        Assert.Equal(180, result.Bpm);
        Assert.Equal(6, result.TimeSignatureNumerator);
        Assert.Equal(8, result.TimeSignatureDenominator);
        Assert.True(result.CreatedAt <= DateTime.UtcNow);
        Assert.True(result.UpdatedAt <= DateTime.UtcNow);
    }

    private static MetronomePreset CreatePreset(string label, int bpm, int tsNum, int tsDen) =>
        new()
        {
            Label = label,
            Bpm = bpm,
            TimeSignatureNumerator = tsNum,
            TimeSignatureDenominator = tsDen,
        };
}
