import type { TimeSignature } from '@mytronome/engine';

export interface NamedTimeSignature {
  label: string;
  value: TimeSignature;
}

/** The presets offered as one-tap buttons. */
export const COMMON_TIME_SIGNATURES: NamedTimeSignature[] = [
  { label: '4/4', value: { beats: 4, noteValue: 4 } },
  { label: '3/4', value: { beats: 3, noteValue: 4 } },
  { label: '2/4', value: { beats: 2, noteValue: 4 } },
  { label: '6/8', value: { beats: 6, noteValue: 8 } },
  { label: '9/8', value: { beats: 9, noteValue: 8 } },
  { label: '12/8', value: { beats: 12, noteValue: 8 } },
  { label: '5/4', value: { beats: 5, noteValue: 4 } },
  { label: '7/8', value: { beats: 7, noteValue: 8 } },
];

/** Selectable beat-unit denominators for the manual picker. */
export const NOTE_VALUES = [1, 2, 4, 8, 16] as const;

export function isSameSignature(a: TimeSignature, b: TimeSignature): boolean {
  return a.beats === b.beats && a.noteValue === b.noteValue;
}
