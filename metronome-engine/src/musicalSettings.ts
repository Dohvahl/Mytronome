import type { BeatEmphasis, TimeSignature } from './types';

// Shared musical limits - the web app imports these instead of redefining them.
// The C# API enforces the same limits in preset-api/Validation/PresetValidator.cs
// (MinBpm / MaxBpm / MaxBeats / NoteValues); those can't be shared across the
// TS/C# boundary, so keep the two in sync by hand.
export const MIN_BPM = 40;
export const MAX_BPM = 320;

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
 * What the metronome is playing: how fast, in what meter, and which beats are
 * emphasised. Purely the musical description — it holds no position and no
 * audio, so it can be read or changed at any point during a run.
 *
 * Values are clamped on the way in, which is why the fields are private: a
 * tempo outside the musical range can never reach the scheduler.
 */
export class MusicalSettings {
  private bpm: number;
  private timeSignature: TimeSignature;
  private pattern: BeatEmphasis[];

  constructor(options: {
    bpm?: number;
    timeSignature?: TimeSignature;
    pattern?: BeatEmphasis[];
  }) {
    this.bpm = clampBpm(options.bpm ?? 120);
    this.timeSignature = options.timeSignature ?? { beats: 4, noteValue: 4 };
    this.pattern = options.pattern ?? defaultPattern(this.timeSignature);
  }

  get tempo(): number {
    return this.bpm;
  }

  get meter(): TimeSignature {
    return this.timeSignature;
  }

  /** How long one beat lasts at the current tempo — the scheduler's step size. */
  get secondsPerBeat(): number {
    return 60 / this.bpm;
  }

  /** Clamped to a sane musical range. */
  setBpm(bpm: number): void {
    this.bpm = clampBpm(bpm);
  }

  setTimeSignature(timeSignature: TimeSignature): void {
    this.timeSignature = timeSignature;
  }

  setPattern(pattern: BeatEmphasis[]): void {
    this.pattern = pattern;
  }

  /**
   * How the given beat of the bar should sound. Falls back sensibly when the
   * pattern is shorter than the meter (e.g. right after a meter change), so the
   * downbeat stays accented and the rest stay normal.
   */
  emphasisFor(beatIndex: number): BeatEmphasis {
    return this.pattern[beatIndex] ?? (beatIndex === 0 ? 'accent' : 'normal');
  }
}

function clampBpm(bpm: number): number {
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)));
}
