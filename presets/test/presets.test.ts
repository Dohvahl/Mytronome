import { describe, it, expect, vi } from 'vitest';
import {
  createPreset,
  duplicatePreset,
  updatePreset,
  samePresetSettings,
  normalizePreset,
} from '../src/presets';
import type { Preset, PresetSettings } from '../src/types';

const settings: PresetSettings = {
  bpm: 120,
  timeSignature: { beats: 4, noteValue: 4 },
  pattern: ['accent', 'normal', 'normal', 'normal'],
  subdivisions: 1,
};

const armedRamp = { enabled: true, stepBpm: 5, everyBars: 4 } as const;
const offRamp = { enabled: false, stepBpm: 5, everyBars: 4 } as const;

describe('createPreset', () => {
  it('builds a preset from settings, trims the label, and matches timestamps', () => {
    const p = createPreset(settings, '  My groove  ');
    expect(p.label).toBe('My groove');
    expect(p.bpm).toBe(120);
    expect(p.timeSignature).toEqual({ beats: 4, noteValue: 4 });
    expect(p.pattern).toEqual(['accent', 'normal', 'normal', 'normal']);
    expect(p.subdivisions).toBe(1);
    expect(p.id).toBeTruthy();
    expect(p.createdAt).toBe(p.updatedAt);
  });

  it('defaults to an empty label and copies the pattern (no shared reference)', () => {
    const p = createPreset(settings);
    expect(p.label).toBe('');
    expect(p.pattern).not.toBe(settings.pattern);
    expect(p.pattern).toEqual(settings.pattern);
  });

  it('gives each preset a unique id', () => {
    expect(createPreset(settings).id).not.toBe(createPreset(settings).id);
  });

  it('stores an armed ramp, copied rather than shared', () => {
    const p = createPreset({ ...settings, ramp: armedRamp });
    expect(p.ramp).toEqual(armedRamp);
    expect(p.ramp).not.toBe(armedRamp);
  });

  it('stores no ramp when the ramp is off, or absent entirely', () => {
    expect(createPreset({ ...settings, ramp: offRamp }).ramp).toBeUndefined();
    expect(createPreset(settings).ramp).toBeUndefined();
  });
});

describe('duplicatePreset', () => {
  it('copies the settings but with a fresh id and a "(copy)" label', () => {
    const original = createPreset(settings, 'Verse');
    const copy = duplicatePreset(original);
    expect(copy.label).toBe('Verse (copy)');
    expect(copy.id).not.toBe(original.id);
    expect(copy.pattern).not.toBe(original.pattern); // deep-copied
    expect(samePresetSettings(copy, original)).toBe(true);
  });

  it('labels a copy of an unlabeled preset "Preset (copy)"', () => {
    const copy = duplicatePreset(createPreset(settings));
    expect(copy.label).toBe('Preset (copy)');
  });

  it('deep-copies the ramp so edits to one copy do not reach the other', () => {
    const original = createPreset({ ...settings, ramp: armedRamp });
    const copy = duplicatePreset(original);
    expect(copy.ramp).toEqual(armedRamp);
    expect(copy.ramp).not.toBe(original.ramp);
  });
});

describe('updatePreset', () => {
  it('applies changes, trims the label, keeps the id, and bumps updatedAt', () => {
    const original = createPreset(settings, 'Old');
    const spy = vi
      .spyOn(Date, 'now')
      .mockReturnValue(original.updatedAt + 1000);
    const updated = updatePreset(original, { bpm: 140, label: '  New  ' });
    spy.mockRestore();

    expect(updated.bpm).toBe(140);
    expect(updated.label).toBe('New');
    expect(updated.timeSignature).toEqual(original.timeSignature);
    expect(updated.id).toBe(original.id);
    expect(updated.createdAt).toBe(original.createdAt);
    expect(updated.updatedAt).toBe(original.updatedAt + 1000);
  });

  it('keeps the existing label when none is provided', () => {
    const original = createPreset(settings, 'Keep');
    expect(updatePreset(original, { bpm: 100 }).label).toBe('Keep');
  });

  it('keeps a saved ramp when the changes do not mention one', () => {
    const original = createPreset({ ...settings, ramp: armedRamp });
    expect(updatePreset(original, { label: 'Renamed' }).ramp).toEqual(
      armedRamp,
    );
  });

  it('clears a saved ramp when the changes turn it off', () => {
    const original = createPreset({ ...settings, ramp: armedRamp });
    expect(updatePreset(original, { ramp: offRamp }).ramp).toBeUndefined();
    expect(updatePreset(original, { ramp: undefined }).ramp).toBeUndefined();
  });
});

describe('samePresetSettings', () => {
  it('is true for musically identical settings', () => {
    expect(
      samePresetSettings(settings, {
        ...settings,
        pattern: [...settings.pattern],
      }),
    ).toBe(true);
  });

  it('is false when bpm, meter, or any beat emphasis differs', () => {
    expect(samePresetSettings(settings, { ...settings, bpm: 121 })).toBe(false);
    expect(
      samePresetSettings(settings, {
        ...settings,
        timeSignature: { beats: 3, noteValue: 4 },
      }),
    ).toBe(false);
    expect(
      samePresetSettings(settings, {
        ...settings,
        pattern: ['normal', 'normal', 'normal', 'normal'],
      }),
    ).toBe(false);
  });

  it('is false when the patterns are different lengths', () => {
    expect(
      samePresetSettings(settings, { ...settings, pattern: ['accent'] }),
    ).toBe(false);
  });

  it('is false when only the subdivision differs', () => {
    expect(samePresetSettings(settings, { ...settings, subdivisions: 2 })).toBe(
      false,
    );
  });

  it('is false when only one side has an armed ramp', () => {
    expect(samePresetSettings(settings, { ...settings, ramp: armedRamp })).toBe(
      false,
    );
  });

  it('is false when the armed ramps differ in step or interval', () => {
    const armed = { ...settings, ramp: armedRamp };
    expect(
      samePresetSettings(armed, {
        ...settings,
        ramp: { ...armedRamp, stepBpm: 6 },
      }),
    ).toBe(false);
    expect(
      samePresetSettings(armed, {
        ...settings,
        ramp: { ...armedRamp, everyBars: 8 },
      }),
    ).toBe(false);
  });

  it('treats an off ramp as no ramp, whatever its numbers say', () => {
    expect(samePresetSettings(settings, { ...settings, ramp: offRamp })).toBe(
      true,
    );
    expect(
      samePresetSettings(settings, {
        ...settings,
        ramp: { enabled: false, stepBpm: 42, everyBars: 99 },
      }),
    ).toBe(true);
  });
});

describe('normalizePreset', () => {
  const base = createPreset(settings);

  it('defaults a missing subdivision to 1 (older saved presets)', () => {
    // Simulate a preset saved before `subdivisions` existed.
    const legacy = { ...base };
    delete (legacy as { subdivisions?: number }).subdivisions;
    expect(normalizePreset(legacy as Preset).subdivisions).toBe(1);
  });

  it('replaces an invalid subdivision with 1', () => {
    expect(normalizePreset({ ...base, subdivisions: 0 }).subdivisions).toBe(1);
    expect(normalizePreset({ ...base, subdivisions: 2.5 }).subdivisions).toBe(
      1,
    );
  });

  it('leaves a valid preset untouched (same reference)', () => {
    const valid = { ...base, subdivisions: 3 };
    expect(normalizePreset(valid)).toBe(valid);
    const withRamp = { ...base, subdivisions: 3, ramp: { ...armedRamp } };
    expect(normalizePreset(withRamp)).toBe(withRamp);
  });

  it('keeps an armed, in-range ramp', () => {
    expect(normalizePreset({ ...base, ramp: { ...armedRamp } }).ramp).toEqual(
      armedRamp,
    );
  });

  it('drops a ramp that was saved switched off', () => {
    expect(normalizePreset({ ...base, ramp: offRamp }).ramp).toBeUndefined();
  });

  it('drops a ramp with out-of-range or non-integer values', () => {
    const bad = [
      { ...armedRamp, stepBpm: 0 },
      { ...armedRamp, stepBpm: 51 },
      { ...armedRamp, stepBpm: 2.5 },
      { ...armedRamp, everyBars: 0 },
      { ...armedRamp, everyBars: 101 },
    ];
    for (const ramp of bad) {
      expect(normalizePreset({ ...base, ramp }).ramp).toBeUndefined();
    }
  });

  it('loads a preset saved before the ramp existed', () => {
    expect(normalizePreset(base).ramp).toBeUndefined();
    // Hand-edited or otherwise corrupt storage must not throw.
    const nulled = { ...base, ramp: null } as unknown as Preset;
    expect(normalizePreset(nulled).ramp).toBeUndefined();
  });
});
