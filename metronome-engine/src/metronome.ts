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
  /** Clicks per beat: 1 = beat only, 2 = eighths, 3 = triplets, 4 = sixteenths… */
  subdivisions?: number;
  /**
   * Called once per beat, at the moment the beat is *scheduled* (slightly
   * before it sounds), including muted beats. `beat.time` is the audio-clock
   * time it will play, so a UI can flash a visual indicator exactly on time.
   */
  onBeat?: (beat: BeatInfo) => void;
}

const MIN_BPM = 40;
const MAX_BPM = 320;
const MAX_SUBDIVISIONS = 16;

type ClickLevel = 'accent' | 'normal' | 'sub';

const CLICK_TONES: Record<ClickLevel, { frequency: number; peak: number }> = {
  accent: { frequency: 1500, peak: 0.6 }, // loud, high downbeat
  normal: { frequency: 1000, peak: 0.4 }, // the other main beats
  sub: { frequency: 1200, peak: 0.18 }, // quiet in-between subdivision tick
};

/** Compound meters (6/8, 9/8, 12/8, …) group their beats in threes. */
export function isCompound(timeSignature: TimeSignature): boolean {
  const { beats, noteValue } = timeSignature;
  return (noteValue === 8 || noteValue === 16) && beats >= 6 && beats % 3 === 0;
}

/**
 * The default emphasis pattern: accent the downbeat, plus — in a compound meter
 * — the start of each group of three, so 6/8 feels like 2, 9/8 like 3, and 12/8
 * like 4 (instead of six even clicks like 6/4).
 */
export function defaultPattern(timeSignature: TimeSignature): BeatEmphasis[] {
  const compound = isCompound(timeSignature);
  return Array.from({ length: timeSignature.beats }, (_, i) => {
    const groupStart = compound ? i % 3 === 0 : i === 0;
    return groupStart ? 'accent' : 'normal';
  });
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
  private subdivisions: number;
  private masterGain: GainNode | null = null;
  private readonly onBeat?: (beat: BeatInfo) => void;

  private isRunning = false;
  private nextBeatTime = 0; // audio-clock time (s) of the next tick to schedule
  private nextBeatIndex = 0; // which beat of the measure comes next
  private subIndex = 0; // subdivision within the current beat (0 = the beat)
  private timerId: number | null = null;

  /** Schedule beats this far (seconds) into the future. */
  private readonly scheduleAheadTime = 0.1;
  /** How often (ms) the scheduler wakes to top up the schedule. */
  private readonly lookaheadMs = 25;

  constructor(options: MetronomeOptions = {}) {
    this.bpm = clampBpm(options.bpm ?? 120);
    this.timeSignature = options.timeSignature ?? { beats: 4, noteValue: 4 };
    this.pattern = options.pattern ?? defaultPattern(this.timeSignature);
    this.volume = clamp01(options.volume ?? 1);
    this.subdivisions = clampSubdivisions(options.subdivisions ?? 1);
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

  /** Clicks per beat (1 = beat only, 2 = eighths, …). Safe to call while running. */
  setSubdivisions(subdivisions: number): void {
    this.subdivisions = clampSubdivisions(subdivisions);
    if (this.subIndex >= this.subdivisions) {
      this.subIndex = 0;
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
    this.subIndex = 0;
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

  /** Runs every `lookaheadMs`; schedules every tick due within the lookahead window. */
  private scheduler(): void {
    if (!this.audioContext) return;

    while (
      this.nextBeatTime <
      this.audioContext.currentTime + this.scheduleAheadTime
    ) {
      const secondsPerBeat = 60 / this.bpm;

      if (this.subIndex === 0) {
        // The main beat: apply its emphasis and notify the UI.
        const emphasis =
          this.pattern[this.nextBeatIndex] ??
          (this.nextBeatIndex === 0 ? 'accent' : 'normal');

        if (emphasis !== 'muted') {
          this.scheduleClick(
            this.nextBeatTime,
            emphasis === 'accent' ? 'accent' : 'normal',
          );
        }

        // Always notify — muted beats still advance the visual indicator.
        this.onBeat?.({ beatIndex: this.nextBeatIndex, time: this.nextBeatTime });
      } else {
        // An in-between subdivision: a softer tick (audio only, no visual).
        this.scheduleClick(this.nextBeatTime, 'sub');
      }

      this.nextBeatTime += secondsPerBeat / this.subdivisions;
      this.subIndex += 1;
      if (this.subIndex >= this.subdivisions) {
        this.subIndex = 0;
        this.nextBeatIndex = (this.nextBeatIndex + 1) % this.timeSignature.beats;
      }
    }
  }

  /** Schedule one short click tone at the given audio-clock time. */
  private scheduleClick(time: number, level: ClickLevel): void {
    const ctx = this.audioContext!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const { frequency, peak } = CLICK_TONES[level];
    osc.frequency.value = frequency;
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

function clampSubdivisions(value: number): number {
  return Math.max(1, Math.min(MAX_SUBDIVISIONS, Math.round(value)));
}
