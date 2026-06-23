import type { BeatEmphasis, BeatInfo, TimeSignature } from './types';

export interface MetronomeOptions {
  /** Starting tempo in beats per minute. Default 120. */
  bpm?: number;
  /** Starting time signature. Default 4/4. */
  timeSignature?: TimeSignature;
  /**
   * Per-beat emphasis pattern (one entry per beat). Defaults to the downbeat
   * accented and the rest normal.
   */
  pattern?: BeatEmphasis[];
  /** Master output volume, 0 (silent) to 1 (full). Default 1. */
  volume?: number;
  /**
   * Called once per beat, at the moment the beat is *scheduled* (slightly
   * before it sounds), including muted beats. `beat.time` is the audio-clock
   * time it will play, so a UI can flash a visual indicator exactly on time.
   */
  onBeat?: (beat: BeatInfo) => void;
}

const MIN_BPM = 40;
const MAX_BPM = 320;

/** Build the default emphasis pattern for a given beat count: downbeat only. */
export function defaultPattern(beats: number): BeatEmphasis[] {
  return Array.from({ length: beats }, (_, i) => (i === 0 ? 'accent' : 'normal'));
}

/**
 * A sample-accurate metronome built on the Web Audio API.
 *
 * Timing strategy — the "Tale of Two Clocks" pattern:
 *   A coarse `setInterval` timer wakes up frequently (every `lookaheadMs`) and,
 *   each time, schedules any beats falling within the next `scheduleAheadTime`
 *   seconds *directly on the audio hardware clock*. The audio clock — not the
 *   JS timer — decides when each click actually sounds. So even if the UI thread
 *   stalls or the tab is throttled, already-scheduled clicks fire perfectly on
 *   time. The JS timer only needs to be "good enough" to keep the schedule
 *   topped up, never accurate to the millisecond.
 */
export class Metronome {
  private audioContext: AudioContext | null = null;
  private bpm: number;
  private timeSignature: TimeSignature;
  private pattern: BeatEmphasis[];
  private volume: number;
  private masterGain: GainNode | null = null;
  private readonly onBeat?: (beat: BeatInfo) => void;

  private isRunning = false;
  private nextBeatTime = 0; // audio-clock time (s) of the next beat to schedule
  private nextBeatIndex = 0; // which beat of the measure comes next
  private timerId: number | null = null;

  /** Schedule beats this far (seconds) into the future. */
  private readonly scheduleAheadTime = 0.1;
  /** How often (ms) the scheduler wakes to top up the schedule. */
  private readonly lookaheadMs = 25;

  constructor(options: MetronomeOptions = {}) {
    this.bpm = clampBpm(options.bpm ?? 120);
    this.timeSignature = options.timeSignature ?? { beats: 4, noteValue: 4 };
    this.pattern = options.pattern ?? defaultPattern(this.timeSignature.beats);
    this.volume = clamp01(options.volume ?? 1);
    this.onBeat = options.onBeat;
  }

  get tempo(): number {
    return this.bpm;
  }

  get meter(): TimeSignature {
    return this.timeSignature;
  }

  get running(): boolean {
    return this.isRunning;
  }

  /** Current audio-clock time in seconds (0 before the engine has started). */
  get currentTime(): number {
    return this.audioContext?.currentTime ?? 0;
  }

  /** Set the tempo. Clamped to a sane musical range. Safe to call while running. */
  setBpm(bpm: number): void {
    this.bpm = clampBpm(bpm);
  }

  /** Change the time signature. Safe to call while running. */
  setTimeSignature(timeSignature: TimeSignature): void {
    this.timeSignature = timeSignature;
    if (this.nextBeatIndex >= timeSignature.beats) {
      this.nextBeatIndex = 0;
    }
  }

  /** Replace the per-beat emphasis pattern. Safe to call while running. */
  setPattern(pattern: BeatEmphasis[]): void {
    this.pattern = pattern;
  }

  /** Master output volume, 0 (silent) to 1 (full). Safe to call while running. */
  setVolume(volume: number): void {
    this.volume = clamp01(volume);
    if (this.masterGain && this.audioContext) {
      // Short ramp avoids a click when the level jumps.
      this.masterGain.gain.setTargetAtTime(
        this.volume,
        this.audioContext.currentTime,
        0.01,
      );
    }
  }

  /** Start ticking. Must be triggered by a user gesture (browser autoplay rule). */
  start(): void {
    if (this.isRunning) return;

    // Create the AudioContext lazily on first start: browsers only allow audio
    // to begin in response to a user gesture (a click), so we can't do this in
    // the constructor.
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      // All clicks route through a master gain so one volume scales them all.
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.audioContext.destination);
    }
    void this.audioContext.resume();

    this.isRunning = true;
    this.nextBeatIndex = 0;
    this.nextBeatTime = this.audioContext.currentTime + 0.05; // brief lead-in
    this.timerId = window.setInterval(() => this.scheduler(), this.lookaheadMs);
  }

  /** Stop ticking. Keeps the AudioContext alive for an instant restart. */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /** Release audio resources. Call when the metronome is gone for good. */
  dispose(): void {
    this.stop();
    void this.audioContext?.close();
    this.audioContext = null;
    this.masterGain = null;
  }

  /** Runs every `lookaheadMs`; schedules every beat due within the lookahead window. */
  private scheduler(): void {
    if (!this.audioContext) return;
    const secondsPerBeat = 60 / this.bpm;

    while (
      this.nextBeatTime <
      this.audioContext.currentTime + this.scheduleAheadTime
    ) {
      // Read the pattern defensively in case its length lags a meter change.
      const emphasis =
        this.pattern[this.nextBeatIndex] ??
        (this.nextBeatIndex === 0 ? 'accent' : 'normal');

      if (emphasis !== 'muted') {
        this.scheduleClick(this.nextBeatTime, emphasis === 'accent');
      }

      // Always notify the UI — muted beats still advance the visual indicator.
      this.onBeat?.({ beatIndex: this.nextBeatIndex, time: this.nextBeatTime });

      this.nextBeatTime += secondsPerBeat;
      this.nextBeatIndex = (this.nextBeatIndex + 1) % this.timeSignature.beats;
    }
  }

  /** Schedule one short click tone at the given audio-clock time. */
  private scheduleClick(time: number, isAccent: boolean): void {
    const ctx = this.audioContext!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // The downbeat is higher-pitched and a touch louder than the other beats.
    osc.frequency.value = isAccent ? 1500 : 1000;
    const peak = isAccent ? 0.6 : 0.4;
    const duration = 0.05;

    // A fast attack then exponential decay makes a crisp "tick" rather than a
    // sustained beep, and ramping (instead of an abrupt stop) avoids audible
    // clicks/pops in the waveform. (Exponential ramps can't reach exactly 0,
    // hence the tiny 0.0001 floor.)
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain).connect(this.masterGain ?? ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
  }
}

function clampBpm(bpm: number): number {
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
