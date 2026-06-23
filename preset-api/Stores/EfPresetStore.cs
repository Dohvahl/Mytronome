using Microsoft.EntityFrameworkCore;
using PresetApi.Data;
using PresetApi.Models;

namespace PresetApi.Stores;

/// <summary>A PresetStore backed by MySQL through EF Core.</summary>
public class EfPresetStore(PresetDbContext db) : IPresetStore
{
	// AsNoTracking: reads don't need change-tracking, so skip its overhead.
	public async Task<IReadOnlyList<Preset>> ListAsync() =>
		await db.Presets.AsNoTracking().ToListAsync();

	public async Task<Preset?> GetAsync(string id) =>
		await db.Presets.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);

	public async Task SaveAsync(Preset preset)
	{
		// Upsert: update if the id already exists, otherwise insert.
		var exists = await db.Presets.AnyAsync(p => p.Id == preset.Id);
		if (exists)
			db.Presets.Update(preset);
		else
			db.Presets.Add(preset);
		await db.SaveChangesAsync();
	}

	public async Task<bool> RemoveAsync(string id)
	{
		var preset = await db.Presets.FindAsync(id);
		if (preset is null)
			return false;
		db.Presets.Remove(preset);
		await db.SaveChangesAsync();
		return true;
	}
}
