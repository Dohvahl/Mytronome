import {
  MAX_RAMP_EVERY_BARS,
  MAX_RAMP_STEP_BPM,
  MIN_RAMP_EVERY_BARS,
  MIN_RAMP_STEP_BPM,
  type TempoRampConfig,
} from '@mytronome/engine';
import type { Preset, PresetSettings } from './types';

/**
 * The ramp as a preset stores it: a copy when armed, nothing when not. Every
 * ramp value entering a preset goes through here, so the invariant "a stored
 * ramp is an armed ramp" holds for saves, updates and copies alike.
 */
function storedRamp(
  ramp: TempoRampConfig | undefined,
): TempoRampConfig | undefined {
  return ramp?.enabled ? { ...ramp } : undefined;
}

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
    ramp: storedRamp(settings.ramp),
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
    ramp: preset.ramp && { ...preset.ramp }, // deep-copied, like the pattern
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
    // Tested by KEY, not by value: `undefined` means "no ramp" here, so a change
    // set that mentions the ramp can clear it, while one that doesn't (a rename,
    // say) leaves the saved ramp alone.
    ramp: 'ramp' in changes ? storedRamp(changes.ramp) : preset.ramp,
    updatedAt: Date.now(),
  };
}

/**
 * True if two settings are musically identical (bpm, meter, accents,
 * subdivision, and tempo ramp).
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
    sameRamp(a.ramp, b.ramp) &&
    a.pattern.length === b.pattern.length &&
    a.pattern.every((emphasis, i) => emphasis === b.pattern[i])
  );
}

/**
 * Compares only ARMED ramps: a disabled one is the same as none at all, so
 * leftover numbers in the ramp panel don't make a saved preset read as modified.
 */
function sameRamp(
  a: TempoRampConfig | undefined,
  b: TempoRampConfig | undefined,
): boolean {
  const armedA = a?.enabled ? a : undefined;
  const armedB = b?.enabled ? b : undefined;
  // Equal only when both are absent; one armed and one not can't match.
  if (!armedA || !armedB) return armedA === armedB;
  return (
    armedA.stepBpm === armedB.stepBpm && armedA.everyBars === armedB.everyBars
  );
}

/**
 * Coerce a preset loaded from storage into the current shape, filling in fields
 * that older saved data predates. `subdivisions` was added after launch, so
 * presets saved before it default to 1 (no subdivision); `ramp` was added later
 * still and is dropped unless it's armed and in range. This is the single
 * migration point — apply it to anything read back from a store.
 */
export function normalizePreset(raw: Preset): Preset {
  const subdivisions =
    Number.isInteger(raw.subdivisions) && raw.subdivisions >= 1
      ? raw.subdivisions
      : 1;
  const ramp = isStorableRamp(raw.ramp) ? raw.ramp : undefined;
  return raw.subdivisions === subdivisions && raw.ramp === ramp
    ? raw
    : { ...raw, subdivisions, ramp };
}

/**
 * Whether a ramp read back from storage is one we'd have written: armed, with
 * whole-number values inside the engine's limits. Anything else — a preset from
 * before the feature, or hand-edited JSON — loads as no ramp at all, so bad data
 * can't reach the scheduler.
 */
function isStorableRamp(ramp: TempoRampConfig | undefined): boolean {
  if (!ramp) return false;
  return (
    ramp.enabled === true &&
    Number.isInteger(ramp.stepBpm) &&
    ramp.stepBpm >= MIN_RAMP_STEP_BPM &&
    ramp.stepBpm <= MAX_RAMP_STEP_BPM &&
    Number.isInteger(ramp.everyBars) &&
    ramp.everyBars >= MIN_RAMP_EVERY_BARS &&
    ramp.everyBars <= MAX_RAMP_EVERY_BARS
  );
}

function copyLabel(label: string): string {
  const base = label.trim() === '' ? 'Preset' : label.trim();
  return `${base} (copy)`;
}

function newId(): string {
  // Available in browsers (secure contexts, incl. localhost) and modern Node.
  return crypto.randomUUID();
}
