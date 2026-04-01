using Mytronome.Core.Models;

namespace Mytronome.Core.Interfaces;

/// <summary>
/// Contract for the metronome timing engine.
/// Manages start/stop, tempo, time signature, and fires beat events.
/// </summary>
public interface IMetronomeEngine : IDisposable
{
    // State
    bool IsRunning { get; }
    Tempo CurrentTempo { get; }
    TimeSignature CurrentTimeSignature { get; }
    int CurrentBeat { get; }
    TempoChangeMode ChangeMode { get; set; }

    // Control
    void Start();
    void Stop();
    void SetTempo(Tempo tempo);
    void SetTimeSignature(TimeSignature timeSignature);

    // Events
    event EventHandler<BeatEventArgs> BeatTicked;
    event EventHandler Started;
    event EventHandler Stopped;
}
