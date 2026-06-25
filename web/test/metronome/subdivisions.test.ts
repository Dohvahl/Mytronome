import { describe, it, expect } from 'vitest';
import {
  subdivisionOptions,
  clampSubdivision,
} from '../../src/metronome/subdivisions';

const QUARTER_GLYPH = '\u{1D15F}';

describe('subdivisionOptions', () => {
  it('offers the full set for a quarter-note beat', () => {
    const counts = subdivisionOptions(4).map((o) => o.count);
    expect(counts).toEqual([1, 2, 3, 4, 6, 8, 12, 16]);
  });

  it('labels count 1 as "No subdivision"', () => {
    const first = subdivisionOptions(4)[0];
    expect(first.count).toBe(1);
    expect(first.name).toBe('No subdivision');
  });

  it('never offers a quarter-note subdivision under an eighth-note beat', () => {
    const glyphs = subdivisionOptions(8)
      .map((o) => o.glyph)
      .filter(Boolean);
    expect(glyphs).not.toContain(QUARTER_GLYPH);
  });

  it('drops options finer than a 128th note for a sixteenth-note beat', () => {
    const counts = subdivisionOptions(16).map((o) => o.count);
    expect(counts).not.toContain(16); // would be a 256th note
    expect(counts).toContain(12); // 128th-note triplet is still notatable
  });

  it('renders triplets with a beam count and no single glyph', () => {
    const triplet = subdivisionOptions(4).find((o) => o.count === 3);
    expect(triplet?.glyph).toBeUndefined();
    expect(triplet?.beams).toBe(1); // eighth-note triplet over a quarter beat
  });
});

describe('clampSubdivision', () => {
  it('preserves the division when still valid (3/4 eighths → 3/8 keeps count 2)', () => {
    expect(clampSubdivision(2, 8)).toBe(2);
  });

  it('leaves any still-valid count unchanged', () => {
    expect(clampSubdivision(6, 4)).toBe(6);
  });

  it('steps down to the nearest coarser option when no longer notatable', () => {
    // count 16 → 256th under a sixteenth-note beat; nearest valid is 12
    expect(clampSubdivision(16, 16)).toBe(12);
  });
});
