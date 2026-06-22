import { useEffect, useRef, useState } from 'react';
import type { TimeSignature } from '@mytronome/engine';
import {
  COMMON_TIME_SIGNATURES,
  NOTE_VALUES,
  isSameSignature,
} from './timeSignatures';
import { EditableNumber } from './EditableNumber';

interface Props {
  value: TimeSignature;
  onChange: (value: TimeSignature) => void;
}

const MIN_BEATS = 1;
const MAX_BEATS = 16;
const CUSTOM = 'custom';

export function TimeSignaturePicker({ value, onChange }: Props) {
  // Which preset (if any) matches the current value; otherwise it's "Custom".
  const matchedPreset = COMMON_TIME_SIGNATURES.find((ts) =>
    isSameSignature(ts.value, value),
  );

  const selectPreset = (label: string) => {
    const preset = COMMON_TIME_SIGNATURES.find((ts) => ts.label === label);
    if (preset) onChange(preset.value);
  };

  return (
    <div className="time-signature">
      {/* #5 — presets as a dropdown */}
      <select
        className="ts-presets"
        value={matchedPreset ? matchedPreset.label : CUSTOM}
        onChange={(e) => selectPreset(e.target.value)}
        aria-label="Common time signatures"
      >
        {!matchedPreset && (
          <option value={CUSTOM} disabled>
            Custom ({value.beats}/{value.noteValue})
          </option>
        )}
        {COMMON_TIME_SIGNATURES.map((ts) => (
          <option key={ts.label} value={ts.label}>
            {ts.label}
          </option>
        ))}
      </select>

      {/* #6 — big manual display; double-click a part to edit it */}
      <div className="ts-manual">
        <EditableNumber
          className="ts-number"
          value={value.beats}
          min={MIN_BEATS}
          max={MAX_BEATS}
          onCommit={(beats) => onChange({ ...value, beats })}
          ariaLabel="Beats per measure"
        />
        <span className="ts-slash">/</span>
        <EditableUnit
          value={value.noteValue}
          options={NOTE_VALUES}
          onChange={(noteValue) => onChange({ ...value, noteValue })}
        />
      </div>
    </div>
  );
}

interface EditableUnitProps {
  value: number;
  options: readonly number[];
  onChange: (value: number) => void;
}

/**
 * Shows the beat unit as plain text. Double-clicking reveals a dropdown to pick
 * a value; choosing one (or clicking away) returns to the text display.
 */
function EditableUnit({ value, options, onChange }: EditableUnitProps) {
  const [editing, setEditing] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) selectRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <select
        ref={selectRef}
        className="ts-number ts-unit-select"
        value={value}
        onChange={(e) => {
          onChange(Number(e.target.value));
          setEditing(false);
        }}
        onBlur={() => setEditing(false)}
        aria-label="Beat unit"
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    );
  }

  return (
    <span
      className="ts-number"
      onDoubleClick={() => setEditing(true)}
      title="Double-click to choose"
    >
      {value}
    </span>
  );
}
