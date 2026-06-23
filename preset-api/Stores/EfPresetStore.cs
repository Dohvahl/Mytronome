using Microsoft.EntityFrameworkCore;
using PresetApi.Data;
using PresetApi.Models;

namespace PresetApi.Stores;

/// <summary>A PresetStore backed by MySQL through EF Core, scoped per owner.</summary>
public class EfPresetStore(PresetDbContext db) : IPresetStore
{
    public async Task<IReadOnlyList<Preset>> ListAsync(string ownerId) =>
        await db.Presets.AsNoTracking()
            .Where(p => EF.Property<string>(p, "OwnerId") == ownerId)
            .ToListAsync();

    public async Task<Preset?> GetAsync(string ownerId, string id) =>
        await db.Presets.AsNoTracking()
            .Where(p => EF.Property<string>(p, "OwnerId") == ownerId && p.Id == id)
            .FirstOrDefaultAsync();

    public async Task SaveAsync(string ownerId, Preset preset)
    {
        // Only treat it as an update if THIS owner already has that id (tracked,
        // so the changes are saved). Otherwise insert and stamp the owner.
        var existing = await db.Presets
            .Where(p => EF.Property<string>(p, "OwnerId") == ownerId && p.Id == preset.Id)
            .FirstOrDefaultAsync();

        if (existing is null)
        {
            var entry = db.Presets.Add(preset);
            entry.Property("OwnerId").CurrentValue = ownerId;
        }
        else
        {
            existing.Label = preset.Label;
            existing.Bpm = preset.Bpm;
            existing.TimeSignature = preset.TimeSignature;
            existing.Pattern = preset.Pattern;
            existing.CreatedAt = preset.CreatedAt;
            existing.UpdatedAt = preset.UpdatedAt;
        }

        await db.SaveChangesAsync();
    }

    public async Task<bool> RemoveAsync(string ownerId, string id)
    {
        var preset = await db.Presets
            .Where(p => EF.Property<string>(p, "OwnerId") == ownerId && p.Id == id)
            .FirstOrDefaultAsync();
        if (preset is null)
            return false;
        db.Presets.Remove(preset);
        await db.SaveChangesAsync();
        return true;
    }
}
