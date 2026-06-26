import { describe, it, expect } from 'vitest';
import { Metronome, defaultPattern, isCompound } from '../src/metronome';
import type { MetronomeOptions } from '../src/metronome';
import { MockAudioOutput } from './mocks';

// The engine needs a platform audio adapter injected; these tests only exercise
// pure tempo/meter logic, so a mock output is all they need.
function makeMetronome(options: Omit<MetronomeOptions, 'audioOutput'> = {}) {
  return new Metronome({ audioOutput: new MockAudioOutput(), ...options });
}

describe('isCompound', () => {
  it('is true for 6/8, 9/8, 12/8 and 6/16', () => {
    expect(isCompound({ beats: 6, noteValue: 8 })).toBe(true);
    expect(isCompound({ beats: 9, noteValue: 8 })).toBe(true);
    expect(isCompound({ beats: 12, noteValue: 8 })).toBe(true);
    expect(isCompound({ beats: 6, noteValue: 16 })).toBe(true);
  });

  it('is false for simple meters, quarter denominators, and non-multiples of 3', () => {
    expect(isCompound({ beats: 4, noteValue: 4 })).toBe(false);
    expect(isCompound({ beats: 3, noteValue: 8 })).toBe(false); // fewer than 6 beats
    expect(isCompound({ beats: 6, noteValue: 4 })).toBe(false); // quarter-note beat
    expect(isCompound({ beats: 7, noteValue: 8 })).toBe(false); // not divisible by 3
  });
});

describe('defaultPattern', () => {
  it('accents only the downbeat in a simple meter', () => {
    expect(defaultPattern({ beats: 4, noteValue: 4 })).toEqual([
      'accent',
      'normal',
      'normal',
      'normal',
    ]);
  });

  it('accents the start of each group of three in a compound meter', () => {
    expect(defaultPattern({ beats: 6, noteValue: 8 })).toEqual([
      'accent',
      'normal',
      'normal',
      'accent',
      'normal',
      'normal',
    ]);
  });

  it('produces exactly one entry per beat', () => {
    expect(defaultPattern({ beats: 5, noteValue: 4 })).toHaveLength(5);
    expect(defaultPattern({ beats: 12, noteValue: 8 })).toHaveLength(12);
  });
});

describe('Metronome tempo', () => {
  it('defaults to 120 BPM and 4/4', () => {
    const m = makeMetronome();
    expect(m.tempo).toBe(120);
    expect(m.meter).toEqual({ beats: 4, noteValue: 4 });
  });

  it('clamps and rounds the constructor tempo to 40–320', () => {
    expect(makeMetronome({ bpm: 10 }).tempo).toBe(40);
    expect(makeMetronome({ bpm: 999 }).tempo).toBe(320);
    expect(makeMetronome({ bpm: 120.4 }).tempo).toBe(120);
  });

  it('clamps setBpm to 40–320', () => {
    const m = makeMetronome();
    m.setBpm(5);
    expect(m.tempo).toBe(40);
    m.setBpm(500);
    expect(m.tempo).toBe(320);
  });
});
