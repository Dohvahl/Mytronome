/** How a single beat sounds. */
export type BeatEmphasis =
  | 'normal' // a regular click
  | 'accent' // the loud, high downbeat
  | 'muted'; // counted visually but silent

/** A musical time signature, e.g. 4/4 or 6/8. */
export interface TimeSignature {
  /** Beats per measure — the top number (e.g. the 3 in 3/4). */
  beats: number;
  /**
   * The note value that gets one beat — the bottom number
   * (4 = quarter note, 8 = eighth note, ...).
   *
   * NOTE: In this version the audible tempo is driven purely by BPM (clicks
   * per minute) and the accent grouping by `beats`. `noteValue` is carried for
   * display and for correct compound-meter handling later.
   */
  noteValue: number;
}

/** Describes a single beat at the moment it is scheduled. */
export interface BeatInfo {
  /** Zero-based index of this beat within the measure (0 = downbeat). */
  beatIndex: number;
  /** AudioContext clock time (in seconds) at which this beat will sound. */
  time: number;
}
