import type { TimeSignature } from '@mytronome/engine';
import {
  COMMON_TIME_SIGNATURES,
  NOTE_VALUES,
  isSameSignature,
} from './timeSignatures';

interface Props {
  value: TimeSignature;
  onChange: (value: TimeSignature) => void;
}

const MIN_BEATS = 1;
const MAX_BEATS = 16;

/**
 * A presentational ("dumb") component: it renders the current time signature
 * and reports changes via `onChange`. It holds no state of its own — the parent
 * owns the value. This is the common React pattern of lifting state up.
 */
export function TimeSignaturePicker({ value, onChange }: Props) {
  return (
    <div className="time-signature">
      <div className="ts-presets">
        {COMMON_TIME_SIGNATURES.map((ts) => (
          <button
            key={ts.label}
            className={`ts-preset ${isSameSignature(ts.value, value) ? 'active' : ''}`}
            onClick={() => onChange(ts.value)}
          >
            {ts.label}
          </button>
        ))}
      </div>

      <div className="ts-manual">
        <input
          type="number"
          min={MIN_BEATS}
          max={MAX_BEATS}
          value={value.beats}
          onChange={(e) =>
            onChange({ ...value, beats: clampBeats(Number(e.target.value)) })
          }
          aria-label="Beats per measure"
        />
        <span className="ts-divider">/</span>
        <select
          value={value.noteValue}
          onChange={(e) =>
            onChange({ ...value, noteValue: Number(e.target.value) })
          }
          aria-label="Beat unit"
        >
          {NOTE_VALUES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function clampBeats(n: number): number {
  if (Number.isNaN(n)) return MIN_BEATS;
  return Math.max(MIN_BEATS, Math.min(MAX_BEATS, Math.round(n)));
}
