import { describe, it, expect, vi } from 'vitest';
import {
  createPreset,
  duplicatePreset,
  updatePreset,
  samePresetSettings,
} from '../src/presets';
import type { PresetSettings } from '../src/types';

const settings: PresetSettings = {
  bpm: 120,
  timeSignature: { beats: 4, noteValue: 4 },
  pattern: ['accent', 'normal', 'normal', 'normal'],
};

describe('createPreset', () => {
  it('builds a preset from settings, trims the label, and matches timestamps', () => {
    const p = createPreset(settings, '  My groove  ');
    expect(p.label).toBe('My groove');
    expect(p.bpm).toBe(120);
    expect(p.timeSignature).toEqual({ beats: 4, noteValue: 4 });
    expect(p.pattern).toEqual(['accent', 'normal', 'normal', 'normal']);
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
});
