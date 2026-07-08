import { describe, it, expect } from 'vitest';
import {
  contrast,
  hexToRgb,
  luminance,
  onAccent,
  usableAccent,
} from '../../src/metronome/accent';

describe('hexToRgb', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb('#b8935a')).toEqual({ r: 184, g: 147, b: 90 });
  });
  it('expands 3-digit shorthand and tolerates no #', () => {
    expect(hexToRgb('fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000')).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('contrast', () => {
  it('is 21:1 for black vs white', () => {
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };
    expect(contrast(white, black)).toBeCloseTo(21, 0);
  });
  it('is symmetric', () => {
    const a = hexToRgb('#b8935a');
    const b = hexToRgb('#16171d');
    expect(contrast(a, b)).toBeCloseTo(contrast(b, a), 5);
  });
});

describe('luminance', () => {
  it('orders black < mid < white', () => {
    expect(luminance({ r: 0, g: 0, b: 0 })).toBeLessThan(
      luminance({ r: 128, g: 128, b: 128 }),
    );
    expect(luminance({ r: 128, g: 128, b: 128 })).toBeLessThan(
      luminance({ r: 255, g: 255, b: 255 }),
    );
  });
});

describe('onAccent', () => {
  it('uses white text on a dark accent', () => {
    expect(onAccent('#1a237e')).toBe('#ffffff'); // deep indigo
  });
  it('uses black text on a light accent', () => {
    expect(onAccent('#ffe082')).toBe('#000000'); // pale amber
  });
});

describe('usableAccent', () => {
  it('leaves a legible pick unchanged', () => {
    expect(usableAccent('#1a73e8', false)).toBe('#1a73e8'); // strong blue clears 3:1 on white
    expect(usableAccent('#b8935a', true)).toBe('#b8935a'); // brass clears 3:1 on the dark bg
  });

  it('darkens a too-light accent for the light theme', () => {
    const out = usableAccent('#ffe082', false); // pale amber, poor on white
    expect(out).not.toBe('#ffe082');
    expect(
      contrast(hexToRgb(out), { r: 255, g: 255, b: 255 }),
    ).toBeGreaterThanOrEqual(3);
  });

  it('lightens a too-dark accent for the dark theme', () => {
    const out = usableAccent('#1a237e', true); // deep indigo, poor on #16171d
    expect(out).not.toBe('#1a237e');
    expect(
      contrast(hexToRgb(out), { r: 22, g: 23, b: 29 }),
    ).toBeGreaterThanOrEqual(3);
  });
});
