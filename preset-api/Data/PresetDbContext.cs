using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using PresetApi.Models;

namespace PresetApi.Data;

// IdentityDbContext brings in the user tables (AspNetUsers, etc.) alongside ours.
public class PresetDbContext(DbContextOptions<PresetDbContext> options)
    : IdentityDbContext<IdentityUser>(options)
{
    public DbSet<Preset> Presets => Set<Preset>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder); // configures the Identity tables

        modelBuilder.Entity<Preset>(preset =>
        {
            preset.HasKey(p => p.Id);
            preset.Property(p => p.Id).HasMaxLength(64);
            preset.Property(p => p.Label).HasMaxLength(200);

            // TimeSignature is stored as extra columns in the presets table.
            preset.OwnsOne(p => p.TimeSignature);

            // OwnerId is a SHADOW property: a real column that scopes each preset
            // to a user, but deliberately NOT a field on the Preset class — so it
            // never appears in the JSON the client sends or receives.
            preset.Property<string>("OwnerId").HasMaxLength(64).IsRequired();
            preset.HasIndex("OwnerId");

            // Pattern (List<string>) maps to a JSON column (primitive collection).
        });
    }
}
