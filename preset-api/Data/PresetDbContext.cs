using Microsoft.EntityFrameworkCore;
using PresetApi.Models;

namespace PresetApi.Data;

public class PresetDbContext(DbContextOptions<PresetDbContext> options)
	: DbContext(options)
{
	public DbSet<Preset> Presets => Set<Preset>();

	protected override void OnModelCreating(ModelBuilder modelBuilder)
	{
		modelBuilder.Entity<Preset>(preset =>
		{
			preset.HasKey(p => p.Id);
			preset.Property(p => p.Id).HasMaxLength(64);
			preset.Property(p => p.Label).HasMaxLength(200);

			// TimeSignature is stored as extra columns in the presets table.
			preset.OwnsOne(p => p.TimeSignature);

			// Pattern (List<string>) is an EF Core primitive collection — it
			// maps to a JSON column automatically, no extra table needed.
		});
	}
}
