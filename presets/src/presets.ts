import type { Preset, PresetSettings } from './types';

/** Create a brand-new preset from settings and an optional label. */
export function createPreset(settings: PresetSettings, label = ''): Preset {
  const now = Date.now();
  return {
    id: newId(),
    label: label.trim(),
    bpm: settings.bpm,
    timeSignature: settings.timeSignature,
    pattern: [...settings.pattern],
    subdivisions: settings.subdivisions,
    createdAt: now,
    updatedAt: now,
  };
}

/** Duplicate a preset: fresh id/timestamps and a "(copy)" label. */
export function duplicatePreset(preset: Preset): Preset {
  const now = Date.now();
  return {
    ...preset,
    id: newId(),
    label: copyLabel(preset.label),
    pattern: [...preset.pattern],
    createdAt: now,
    updatedAt: now,
  };
}

/** Return a copy of a preset with some fields changed and updatedAt bumped. */
export function updatePreset(
  preset: Preset,
  changes: Partial<PresetSettings & { label: string }>,
): Preset {
  return {
    ...preset,
    ...changes,
    label: changes.label !== undefined ? changes.label.trim() : preset.label,
    pattern: changes.pattern ? [...changes.pattern] : preset.pattern,
    updatedAt: Date.now(),
  };
}

/**
 * True if two settings are musically identical (bpm, meter, accents, and
 * subdivision).
 */
export function samePresetSettings(
  a: PresetSettings,
  b: PresetSettings,
): boolean {
  return (
    a.bpm === b.bpm &&
    a.timeSignature.beats === b.timeSignature.beats &&
    a.timeSignature.noteValue === b.timeSignature.noteValue &&
    a.subdivisions === b.subdivisions &&
    a.pattern.length === b.pattern.length &&
    a.pattern.every((emphasis, i) => emphasis === b.pattern[i])
  );
}

/**
 * Coerce a preset loaded from storage into the current shape, filling in fields
 * that older saved data predates. `subdivisions` was added after launch, so
 * presets saved before it default to 1 (no subdivision). This is the single
 * migration point — apply it to anything read back from a store.
 */
export function normalizePreset(raw: Preset): Preset {
  const subdivisions =
    Number.isInteger(raw.subdivisions) && raw.subdivisions >= 1
      ? raw.subdivisions
      : 1;
  return raw.subdivisions === subdivisions ? raw : { ...raw, subdivisions };
}

function copyLabel(label: string): string {
  const base = label.trim() === '' ? 'Preset' : label.trim();
  return `${base} (copy)`;
}

function newId(): string {
  // Available in browsers (secure contexts, incl. localhost) and modern Node.
  return crypto.randomUUID();
}
