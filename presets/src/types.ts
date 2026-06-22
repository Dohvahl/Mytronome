import type { BeatEmphasis, TimeSignature } from '@mytronome/engine';

/** A saved metronome configuration. */
export interface Preset {
  /** Stable unique identifier. */
  id: string;
  /** Optional user-given label. May be an empty string. */
  label: string;
  bpm: number;
  timeSignature: TimeSignature;
  /** Per-beat emphasis pattern; its length matches timeSignature.beats. */
  pattern: BeatEmphasis[];
  /** When the preset was created (epoch milliseconds). */
  createdAt: number;
  /** When the preset was last changed (epoch milliseconds). */
  updatedAt: number;
}

/** The musical content of a preset — everything except identity and metadata. */
export type PresetSettings = Pick<Preset, 'bpm' | 'timeSignature' | 'pattern'>;
