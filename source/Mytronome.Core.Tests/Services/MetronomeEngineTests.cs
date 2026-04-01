using Mytronome.Core.Interfaces;
using Mytronome.Core.Models;
using Mytronome.Core.Services;
using NSubstitute;

namespace Mytronome.Core.Tests.Services;

public class MetronomeEngineTests : IDisposable
{
    private readonly IAudioPlayer _audioPlayer;
    private readonly MetronomeEngine _engine;

    public MetronomeEngineTests()
    {
        // Create a fake IAudioPlayer that records all calls but doesn't play sound
        _audioPlayer = Substitute.For<IAudioPlayer>();
        _engine = new MetronomeEngine(_audioPlayer);
    }

    public void Dispose()
    {
        _engine.Dispose();
        GC.SuppressFinalize(this);
    }

    [Fact]
    public void InitialState_IsNotRunning()
    {
        Assert.False(_engine.IsRunning);
    }

    [Fact]
    public void InitialState_HasDefaultTempo()
    {
        Assert.Equal(120, _engine.CurrentTempo.Bpm);
    }

    [Fact]
    public void InitialState_HasDefaultTimeSignature()
    {
        Assert.Equal(4, _engine.CurrentTimeSignature.BeatsPerMeasure);
    }

    [Fact]
    public void Start_SetsIsRunningTrue()
    {
        _engine.Start();
        Assert.True(_engine.IsRunning);
    }

    [Fact]
    public void Start_FiresStartedEvent()
    {
        bool eventFired = false;
        _engine.Started += (_, _) => eventFired = true;

        _engine.Start();

        Assert.True(eventFired);
    }

    [Fact]
    public void Stop_SetsIsRunningFalse()
    {
        _engine.Start();
        _engine.Stop();
        Assert.False(_engine.IsRunning);
    }

    [Fact]
    public void Stop_FiresStoppedEvent()
    {
        _engine.Start();

        bool eventFired = false;
        _engine.Stopped += (_, _) => eventFired = true;

        _engine.Stop();

        Assert.True(eventFired);
    }

    [Fact]
    public void Start_WhenAlreadyRunning_IsIdempotent()
    {
        int startCount = 0;
        _engine.Started += (_, _) => startCount++;

        _engine.Start();
        _engine.Start(); // Second call should be ignored

        Assert.Equal(1, startCount);
    }

    [Fact]
    public void SetTempo_WhenStopped_AppliesImmediately()
    {
        _engine.SetTempo(new Tempo(140));
        Assert.Equal(140, _engine.CurrentTempo.Bpm);
    }

    [Fact]
    public void SetTimeSignature_UpdatesCurrentTimeSignature()
    {
        _engine.SetTimeSignature(new TimeSignature(3, 4));
        Assert.Equal(3, _engine.CurrentTimeSignature.BeatsPerMeasure);
    }

    [Fact]
    public void FirstBeat_IsAccent()
    {
        // Use a fast tempo so the test completes quickly
        _engine.SetTempo(new Tempo(Tempo.MaxBpm));

        // Wait for the first beat using a thread synchronization primitive
        var beatReceived = new ManualResetEventSlim(false);
        BeatEventArgs? firstBeat = null;

        _engine.BeatTicked += (_, args) =>
        {
            firstBeat = args;
            beatReceived.Set(); // Signal that we got a beat
        };

        _engine.Start();

        // Wait up to 2 seconds for the first beat (should happen in ~187ms at 320 BPM)
        bool received = beatReceived.Wait(TimeSpan.FromSeconds(2));
        _engine.Stop();

        Assert.True(received, "Timed out waiting for first beat");
        Assert.NotNull(firstBeat);
        Assert.Equal(1, firstBeat.BeatNumber);
        Assert.True(firstBeat.IsAccent);
    }

    [Fact]
    public void FirstBeat_PlaysAccentClick()
    {
        _engine.SetTempo(new Tempo(Tempo.MaxBpm));

        var beatReceived = new ManualResetEventSlim(false);
        _engine.BeatTicked += (_, _) => beatReceived.Set();

        _engine.Start();
        beatReceived.Wait(TimeSpan.FromSeconds(2));
        _engine.Stop();

        // The accent click should have been called at least once (for beat 1)
        _audioPlayer.Received().PlayAccentClick();
    }

    [Fact]
    public void BeatSequence_CyclesCorrectly_In4_4Time()
    {
        _engine.SetTempo(new Tempo(Tempo.MaxBpm));
        _engine.SetTimeSignature(new TimeSignature(4, 4));

        // Collect the first 8 beats (2 full measures)
        var beats = new List<BeatEventArgs>();
        var allCollected = new ManualResetEventSlim(false);

        _engine.BeatTicked += (_, args) =>
        {
            beats.Add(args);
            if (beats.Count >= 8)
                allCollected.Set();
        };

        _engine.Start();
        bool received = allCollected.Wait(TimeSpan.FromSeconds(10));
        _engine.Stop();

        Assert.True(received, "Timed out waiting for 8 beats");

        // Verify beat numbers cycle: 1, 2, 3, 4, 1, 2, 3, 4
        int[] expectedBeatNumbers = [1, 2, 3, 4, 1, 2, 3, 4];
        for (int i = 0; i < 8; i++)
        {
            Assert.Equal(expectedBeatNumbers[i], beats[i].BeatNumber);
        }

        // Verify accents are only on beat 1
        Assert.True(beats[0].IsAccent);
        Assert.False(beats[1].IsAccent);
        Assert.False(beats[2].IsAccent);
        Assert.False(beats[3].IsAccent);
        Assert.True(beats[4].IsAccent);
    }

    [Fact]
    public void BeatSequence_In3_4Time_Has3Beats()
    {
        _engine.SetTempo(new Tempo(Tempo.MaxBpm));
        _engine.SetTimeSignature(new TimeSignature(3, 4));

        var beats = new List<BeatEventArgs>();
        var allCollected = new ManualResetEventSlim(false);

        _engine.BeatTicked += (_, args) =>
        {
            beats.Add(args);
            if (beats.Count >= 6)
                allCollected.Set();
        };

        _engine.Start();
        bool received = allCollected.Wait(TimeSpan.FromSeconds(10));
        _engine.Stop();

        Assert.True(received, "Timed out waiting for 6 beats");

        // 3/4 time: 1, 2, 3, 1, 2, 3
        int[] expectedBeatNumbers = [1, 2, 3, 1, 2, 3];
        for (int i = 0; i < 6; i++)
        {
            Assert.Equal(expectedBeatNumbers[i], beats[i].BeatNumber);
        }

        // All beats should report TotalBeats = 3
        Assert.All(beats, b => Assert.Equal(3, b.TotalBeats));
    }

    [Fact]
    public void ChangeMode_DefaultsToImmediate()
    {
        Assert.Equal(TempoChangeMode.Immediate, _engine.ChangeMode);
    }
}
