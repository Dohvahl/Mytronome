import type { BeatEmphasis, BeatInfo, TimeSignature } from './types';
import {
  browserTimer,
  type AudioOutput,
  type IntervalTimer,
} from './audioOutput';

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
  /**
   * Where clicks are realized: the platform adapter.
   * Required: each platform provides its own
   * (the web app injects a Web Audio adapter, a future native
   * client its own, tests a mock). The engine itself stays platform-free.
   */
  audioOutput: AudioOutput;
  /**
   * The lookahead-loop timer. Defaults to the host's `setInterval`. Injected
   * mainly so tests can step the scheduler deterministically.
   */
  timer?: IntervalTimer;
}

// Shared musical limits - the web app imports these instead of redefining them.
// The C# API enforces the same limits in preset-api/Validation/PresetValidator.cs
// (MinBpm / MaxBpm / MaxBeats / NoteValues); those can't be shared across the
// TS/C# boundary, so keep the two in sync by hand.
export const MIN_BPM = 40;
export const MAX_BPM = 320;
export const MAX_SUBDIVISIONS = 16;

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
 * A sample-accurate metronome. It plans clicks against an injected
 * {@link AudioOutput}'s clock and stays platform-free itself — the Web Audio
 * implementation lives in the web app, a native one would live in its client.
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
  private readonly output: AudioOutput;
  private readonly timer: IntervalTimer;
  private bpm: number;
  private timeSignature: TimeSignature;
  private pattern: BeatEmphasis[];
  private subdivisions: number;
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

  constructor(options: MetronomeOptions) {
    this.bpm = clampBpm(options.bpm ?? 120);
    this.timeSignature = options.timeSignature ?? { beats: 4, noteValue: 4 };
    this.pattern = options.pattern ?? defaultPattern(this.timeSignature);
    this.subdivisions = clampSubdivisions(options.subdivisions ?? 1);
    this.onBeat = options.onBeat;
    this.output = options.audioOutput;
    this.output.setVolume(options.volume ?? 1); // adapter clamps to 0..1
    this.timer = options.timer ?? browserTimer;
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
    return this.output.currentTime;
  }

  /**
   * Estimated seconds between a click being scheduled and it reaching the
   * speaker (see {@link AudioOutput.outputLatency}). A UI adds this to the delay
   * before flashing the visual beat so it lands when the click is *heard* — the
   * difference is negligible on desktop but large in a mobile webview.
   */
  get outputLatency(): number {
    return this.output.outputLatency;
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
    this.output.setVolume(volume);
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

    // Starting the output creates/resumes its clock (in browsers this must
    // happen inside a user gesture). currentTime is live immediately after.
    void this.output.resume();

    this.isRunning = true;
    this.nextBeatIndex = 0;
    this.subIndex = 0;
    this.nextBeatTime = this.output.currentTime + 0.05; // brief lead-in
    this.timerId = this.timer.setInterval(
      () => this.scheduler(),
      this.lookaheadMs,
    );
  }

  /** Stop ticking. Keeps the output's clock alive for an instant restart. */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timerId !== null) {
      this.timer.clearInterval(this.timerId);
      this.timerId = null;
    }
    // Clearing the lookahead timer stops *new* clicks being queued, but clicks
    // already scheduled ahead of "now" would still sound. Cancel those too.
    this.output.cancelScheduled();
  }

  /** Release audio resources. Call when the metronome is gone for good. */
  dispose(): void {
    this.stop();
    this.output.dispose();
  }

  /** Runs every `lookaheadMs`; schedules every tick due within the lookahead window. */
  private scheduler(): void {
    while (
      this.nextBeatTime <
      this.output.currentTime + this.scheduleAheadTime
    ) {
      const secondsPerBeat = 60 / this.bpm;

      if (this.subIndex === 0) {
        // The main beat: apply its emphasis and notify the UI.
        const emphasis =
          this.pattern[this.nextBeatIndex] ??
          (this.nextBeatIndex === 0 ? 'accent' : 'normal');

        if (emphasis !== 'muted') {
          this.output.scheduleClick(
            this.nextBeatTime,
            emphasis === 'accent' ? 'accent' : 'normal',
          );
        }

        // Always notify — muted beats still advance the visual indicator.
        this.onBeat?.({
          beatIndex: this.nextBeatIndex,
          time: this.nextBeatTime,
        });
      } else {
        // An in-between subdivision: a softer tick (audio only, no visual).
        this.output.scheduleClick(this.nextBeatTime, 'sub');
      }

      this.nextBeatTime += secondsPerBeat / this.subdivisions;
      this.subIndex += 1;
      if (this.subIndex >= this.subdivisions) {
        this.subIndex = 0;
        this.nextBeatIndex =
          (this.nextBeatIndex + 1) % this.timeSignature.beats;
      }
    }
  }
}

function clampBpm(bpm: number): number {
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)));
}

function clampSubdivisions(value: number): number {
  return Math.max(1, Math.min(MAX_SUBDIVISIONS, Math.round(value)));
}
