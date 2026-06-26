using Microsoft.EntityFrameworkCore;
using PresetApi.Data;
using PresetApi.Models;
using PresetApi.Stores;
using Xunit;

namespace PresetApi.Tests;

/// <summary>
/// Exercises the per-owner scoping that is the whole multi-tenant security
/// boundary, plus the storage quota. Uses the EF Core in-memory provider.
/// </summary>
public class EfPresetStoreTests
{
    private static PresetDbContext NewContext() =>
        new(
            new DbContextOptionsBuilder<PresetDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options
        );

    private static Preset SamplePreset(string id) =>
        new()
        {
            Id = id,
            Label = "Test",
            Bpm = 120,
            TimeSignature = new TimeSignature { Beats = 4, NoteValue = 4 },
            Pattern = ["accent", "normal", "normal", "normal"],
        };

    [Fact]
    public async Task Presets_are_scoped_to_their_owner()
    {
        await using var db = NewContext();
        var store = new EfPresetStore(db);

        await store.SaveAsync("userA", SamplePreset("p1"));

        Assert.NotNull(await store.GetAsync("userA", "p1"));
        Assert.Null(await store.GetAsync("userB", "p1")); // B can't read A's preset
        Assert.Empty(await store.ListAsync("userB"));
        Assert.Single(await store.ListAsync("userA"));
    }

    [Fact]
    public async Task A_user_cannot_take_over_an_id_owned_by_someone_else()
    {
        await using var db = NewContext();
        var store = new EfPresetStore(db);

        var a = SamplePreset("shared-id");
        a.Bpm = 100;
        await store.SaveAsync("userA", a);

        var b = SamplePreset("shared-id");
        b.Bpm = 200;
        var result = await store.SaveAsync("userB", b); // same id, different owner

        Assert.Equal(SaveResult.IdConflict, result); // rejected cleanly, no PK blow-up
        Assert.Equal(100, (await store.GetAsync("userA", "shared-id"))!.Bpm); // A untouched
        Assert.Null(await store.GetAsync("userB", "shared-id")); // B got nothing
    }

    [Fact]
    public async Task A_user_cannot_delete_anothers_preset()
    {
        await using var db = NewContext();
        var store = new EfPresetStore(db);
        await store.SaveAsync("userA", SamplePreset("p1"));

        Assert.False(await store.RemoveAsync("userB", "p1")); // B can't delete A's
        Assert.NotNull(await store.GetAsync("userA", "p1")); // still there
        Assert.True(await store.RemoveAsync("userA", "p1")); // A can
    }

    [Fact]
    public async Task Saving_an_existing_preset_updates_it_in_place()
    {
        await using var db = NewContext();
        var store = new EfPresetStore(db);
        await store.SaveAsync("userA", SamplePreset("p1"));

        var edited = SamplePreset("p1");
        edited.Bpm = 90;
        var result = await store.SaveAsync("userA", edited);

        Assert.Equal(SaveResult.Updated, result);
        Assert.Single(await store.ListAsync("userA"));
        Assert.Equal(90, (await store.GetAsync("userA", "p1"))!.Bpm);
    }

    [Fact]
    public async Task New_presets_past_the_quota_are_rejected_but_updates_still_pass()
    {
        await using var db = NewContext();
        var store = new EfPresetStore(db);

        for (var i = 0; i < EfPresetStore.MaxPresetsPerOwner; i++)
            Assert.Equal(
                SaveResult.Created,
                await store.SaveAsync("userA", SamplePreset($"p{i}"))
            );

        // One past the cap is rejected...
        Assert.Equal(
            SaveResult.QuotaExceeded,
            await store.SaveAsync("userA", SamplePreset("over"))
        );

        // ...but updating an existing preset still succeeds at the cap.
        var edited = SamplePreset("p0");
        edited.Bpm = 80;
        Assert.Equal(SaveResult.Updated, await store.SaveAsync("userA", edited));
    }
}
