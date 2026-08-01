import type {
  BeatEmphasis,
  TempoRampConfig,
  TimeSignature,
} from '@mytronome/engine';

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
  /** Clicks per beat (1 = no subdivision). Added after launch — see
   * {@link normalizePreset} for how older, subdivision-less presets load. */
  subdivisions: number;
  /**
   * Automatic tempo ramp-up. Present only when the ramp was ARMED at save time:
   * a preset describes how to practise a passage, and a switched-off ramp is the
   * absence of one rather than a setting worth storing. Everything below treats
   * "off" and "absent" as the same state — see {@link normalizePreset}.
   */
  ramp?: TempoRampConfig;
  /** When the preset was created (epoch milliseconds). */
  createdAt: number;
  /** When the preset was last changed (epoch milliseconds). */
  updatedAt: number;
}

/** The musical content of a preset — everything except identity and metadata. */
export type PresetSettings = Pick<
  Preset,
  'bpm' | 'timeSignature' | 'pattern' | 'subdivisions' | 'ramp'
>;
