using System.Diagnostics;
using Mytronome.Core.Interfaces;
using Mytronome.Core.Models;

namespace Mytronome.Core.Services;

/// <summary>
/// High-precision metronome timing engine using a dedicated thread and Stopwatch.
/// Fires beat events at accurate intervals and supports tempo changes while playing.
/// </summary>
public class MetronomeEngine : IMetronomeEngine
{
    private readonly IAudioPlayer _audioPlayer;
    private Thread? _thread;
    private volatile bool _running;
    private Tempo _tempo;
    private TimeSignature _timeSignature;
    private int _currentBeat;

    // Tempo change state
    private Tempo? _pendingTempo;
    private readonly object _tempoLock = new();

    // Gradual ramp state
    private bool _isRamping;
    private double _rampStartBpm;
    private double _rampTargetBpm;
    private int _rampBarsRemaining;
    private const int RampBars = 4;

    public MetronomeEngine(IAudioPlayer audioPlayer)
    {
        _audioPlayer = audioPlayer;
        _tempo = new Tempo(120);
        _timeSignature = TimeSignature.CommonPresets[0]; // 4/4
    }

    // IMetronomeEngine properties
    public bool IsRunning => _running;
    public Tempo CurrentTempo => _tempo;
    public TimeSignature CurrentTimeSignature => _timeSignature;
    public int CurrentBeat => _currentBeat;
    public TempoChangeMode ChangeMode { get; set; } = TempoChangeMode.Immediate;

    // Events
    public event EventHandler<BeatEventArgs>? BeatTicked;
    public event EventHandler? Started;
    public event EventHandler? Stopped;

    public void Start()
    {
        if (_running) return;

        _running = true;
        _currentBeat = 0;
        _thread = new Thread(TimingLoop)
        {
            IsBackground = true,
            Priority = ThreadPriority.AboveNormal,
            Name = "MetronomeTiming"
        };
        _thread.Start();
        Started?.Invoke(this, EventArgs.Empty);
    }

    public void Stop()
    {
        if (!_running) return;

        _running = false;
        _thread?.Join(timeout: TimeSpan.FromSeconds(2));
        _thread = null;
        _currentBeat = 0;

        // Clear any pending tempo change
        lock (_tempoLock)
        {
            _pendingTempo = null;
            _isRamping = false;
        }

        Stopped?.Invoke(this, EventArgs.Empty);
    }

    /// <summary>
    /// Queues a tempo change. Takes effect at the next downbeat (beat 1).
    /// If the metronome is stopped, applies immediately.
    /// </summary>
    public void SetTempo(Tempo tempo)
    {
        if (!_running)
        {
            _tempo = tempo;
            return;
        }

        lock (_tempoLock)
        {
            _pendingTempo = tempo;
        }
    }

    public void SetTimeSignature(TimeSignature timeSignature)
    {
        _timeSignature = timeSignature;
    }

    /// <summary>
    /// The core timing loop. Runs on a dedicated high-priority thread.
    /// Uses Stopwatch for sub-millisecond precision with a hybrid sleep+spin approach.
    /// </summary>
    private void TimingLoop()
    {
        int beatIndex = 0;
        long startTimestamp = Stopwatch.GetTimestamp();
        double currentIntervalMs = _tempo.IntervalMs;

        while (_running)
        {
            // Calculate absolute target timestamp for this beat.
            // Using absolute anchoring prevents cumulative drift.
            double targetOffsetMs = beatIndex * currentIntervalMs;
            long targetTimestamp = startTimestamp
                + (long)(targetOffsetMs * Stopwatch.Frequency / 1000.0);

            // Phase 1: Coarse wait — sleep while more than 2ms away.
            // Thread.Sleep(1) yields the CPU but has ~1-15ms resolution on Windows.
            while (_running)
            {
                long remaining = targetTimestamp - Stopwatch.GetTimestamp();
                double remainingMs = (double)remaining / Stopwatch.Frequency * 1000.0;
                if (remainingMs <= 2.0) break;
                Thread.Sleep(1);
            }

            // Phase 2: Fine wait — spin for the last ~2ms for precise timing.
            while (_running && Stopwatch.GetTimestamp() < targetTimestamp)
            {
                Thread.SpinWait(10);
            }

            if (!_running) break;

            // Calculate beat position within the measure (1-based)
            int beatsPerMeasure = _timeSignature.BeatsPerMeasure;
            int beatInMeasure = (beatIndex % beatsPerMeasure) + 1;
            bool isAccent = beatInMeasure == 1;
            bool isDownbeat = beatInMeasure == 1;

            // Play the appropriate click sound
            if (isAccent)
                _audioPlayer.PlayAccentClick();
            else
                _audioPlayer.PlayNormalClick();

            // Update state and fire event
            _currentBeat = beatInMeasure;
            BeatTicked?.Invoke(this, new BeatEventArgs
            {
                BeatNumber = beatInMeasure,
                TotalBeats = beatsPerMeasure,
                IsAccent = isAccent
            });

            // At each downbeat, check for pending tempo changes
            if (isDownbeat)
            {
                bool tempoChanged = ApplyPendingTempoChange();
                if (tempoChanged)
                {
                    // Re-anchor: reset the start timestamp and beat index so the
                    // new interval takes effect from this exact moment.
                    currentIntervalMs = _tempo.IntervalMs;
                    startTimestamp = Stopwatch.GetTimestamp();
                    beatIndex = 0;
                    continue; // Skip the beatIndex++ below since we reset to 0
                }
            }

            beatIndex++;
        }
    }

    /// <summary>
    /// Checks for and applies pending tempo changes at the downbeat.
    /// Returns true if the tempo was changed (so the timing loop can re-anchor).
    /// </summary>
    private bool ApplyPendingTempoChange()
    {
        lock (_tempoLock)
        {
            // Handle ongoing gradual ramp
            if (_isRamping)
            {
                _rampBarsRemaining--;
                if (_rampBarsRemaining <= 0)
                {
                    // Ramp complete — apply final target tempo
                    _tempo = new Tempo((int)Math.Round(_rampTargetBpm));
                    _isRamping = false;
                    return true;
                }

                // Calculate the next intermediate BPM step
                double progress = 1.0 - ((double)_rampBarsRemaining / RampBars);
                double newBpm = _rampStartBpm + ((_rampTargetBpm - _rampStartBpm) * progress);
                _tempo = new Tempo((int)Math.Round(newBpm));
                return true;
            }

            // Check for a new pending tempo change
            if (_pendingTempo is not { } pending) return false;
            _pendingTempo = null;

            if (ChangeMode == TempoChangeMode.Immediate)
            {
                _tempo = pending;
                return true;
            }

            // Gradual mode: start a 4-bar ramp
            _isRamping = true;
            _rampStartBpm = _tempo.Bpm;
            _rampTargetBpm = pending.Bpm;
            _rampBarsRemaining = RampBars;

            // Apply the first intermediate step immediately
            double firstProgress = 1.0 / RampBars;
            double firstBpm = _rampStartBpm + ((_rampTargetBpm - _rampStartBpm) * firstProgress);
            _tempo = new Tempo((int)Math.Round(firstBpm));
            return true;
        }
    }

    public void Dispose()
    {
        Stop();
        GC.SuppressFinalize(this);
    }
}
