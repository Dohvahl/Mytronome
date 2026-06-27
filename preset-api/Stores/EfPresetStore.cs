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

    /// <summary>Max presets a single owner may store (storage-exhaustion guard).</summary>
    public const int MaxPresetsPerOwner = 200;

    public async Task<SaveResult> SaveAsync(string ownerId, Preset preset)
    {
        // Only treat it as an update if THIS owner already has that id (tracked,
        // so the changes are saved). Otherwise insert and stamp the owner.
        var existing = await db.Presets
            .Where(p => EF.Property<string>(p, "OwnerId") == ownerId && p.Id == preset.Id)
            .FirstOrDefaultAsync();

        if (existing is null)
        {
            // The key is composite (OwnerId, Id), so an id is unique only within
            // this owner — another user's identical id is a separate row. There's
            // no cross-owner collision (or probe) to guard against here.

            // The cap applies only to NEW presets; updating an existing one always passes.
            var ownedCount = await db.Presets
                .CountAsync(p => EF.Property<string>(p, "OwnerId") == ownerId);
            if (ownedCount >= MaxPresetsPerOwner)
                return SaveResult.QuotaExceeded;

            // Stamp timestamps server-side; don't trust the client's values.
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            preset.CreatedAt = now;
            preset.UpdatedAt = now;

            // OwnerId is now part of the (composite) key, so it must be set BEFORE
            // the entity starts being tracked as Added — EF rejects a null key the
            // moment it transitions to Added. So set the shadow value on a detached
            // entry first, then mark it Added.
            var entry = db.Entry(preset);
            entry.Property("OwnerId").CurrentValue = ownerId;
            entry.State = EntityState.Added;
            await db.SaveChangesAsync();
            return SaveResult.Created;
        }

        existing.Label = preset.Label;
        existing.Bpm = preset.Bpm;
        existing.TimeSignature = preset.TimeSignature;
        existing.Pattern = preset.Pattern;
        // Preserve the original CreatedAt; bump UpdatedAt to server time.
        existing.UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await db.SaveChangesAsync();
        return SaveResult.Updated;
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
