import { useCallback, useEffect, useState } from 'react';
import type { TimeSignature } from '@mytronome/engine';
import {
  COMMON_TIME_SIGNATURES,
  NOTE_VALUES,
  isSameSignature,
} from './timeSignatures';
import { usePointDragAdjust, useWheelAdjust } from './hooks';

interface Props {
  value: TimeSignature;
  onChange: (value: TimeSignature) => void;
}

const MIN_BEATS = 1;
const MAX_BEATS = 16;

// Allowed beat counts, as an array so the spinner steps through them.
const BEAT_OPTIONS = Array.from(
  { length: MAX_BEATS - MIN_BEATS + 1 },
  (_, i) => MIN_BEATS + i,
);

export function TimeSignaturePicker({ value, onChange }: Props) {
  // Which preset (if any) matches the current value; otherwise it's "Custom".
  const matchedPreset = COMMON_TIME_SIGNATURES.find((ts) =>
    isSameSignature(ts.value, value),
  );

  const selectPreset = (label: string) => {
    const preset = COMMON_TIME_SIGNATURES.find((ts) => ts.label === label);
    if (preset) onChange(preset.value);
  };

  // Closed = show the current signature as a dropdown-style button. Open =
  // show two spinners + an accept button. Edits are drafted locally and only
  // applied (via onChange) when accepted.
  const [editing, setEditing] = useState(false);
  const [draftBeats, setDraftBeats] = useState(value.beats);
  const [draftNote, setDraftNote] = useState(value.noteValue);

  const open = () => {
    setDraftBeats(value.beats);
    setDraftNote(value.noteValue);
    setEditing(true);
  };
  const accept = () => {
    onChange({ beats: draftBeats, noteValue: draftNote });
    setEditing(false);
  };

  // While editing: Enter accepts, Escape cancels (a click on the backdrop
  // accepts). Re-subscribes when the draft changes so accept sees the latest.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') accept();
      else if (e.key === 'Escape') setEditing(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, draftBeats, draftNote]);

  const tsPresetsWheelRef = useWheelAdjust<HTMLButtonElement>((dir) => {
    adjustTSPreset(dir);
  });

  return (
    <div className="time-signature">
      {/* Display form — stays in place so opening the editor doesn't reflow. */}
      <button
        type="button"
        className="ts-trigger"
        ref={tsPresetsWheelRef}
        onClick={open}
        aria-haspopup="dialog"
        aria-expanded={editing}
        aria-label={`Time signature: ${value.beats}/${value.noteValue}. Click to change.`}
      >
        <span className="ts-trigger-value">
          {value.beats}/{value.noteValue}
        </span>
        <span className="ts-trigger-chevron" aria-hidden="true">
          &#9662;
        </span>
      </button>

      {/* Edit form — a centered overlay on the same vertical plane as the row,
          over a semi-transparent backdrop. Clicking the backdrop accepts the
          current draft; Escape cancels. */}
      {editing && (
        <>
          <div className="ts-backdrop" onClick={accept} />
          <div
            className="ts-editor"
            role="dialog"
            aria-label="Edit time signature"
          >
            <WheelPicker
              value={draftBeats}
              options={BEAT_OPTIONS}
              onChange={setDraftBeats}
              ariaLabel="Beats per measure"
              swipeThreshold={24}
            />
            <span className="ts-slash">/</span>
            <WheelPicker
              value={draftNote}
              options={NOTE_VALUES}
              onChange={setDraftNote}
              ariaLabel="Beat unit"
              swipeThreshold={48}
            />
            <button
              type="button"
              className="ts-accept"
              onClick={accept}
              aria-label="Apply time signature"
            >
              &#10003;
            </button>
          </div>
        </>
      )}
    </div>
  );

  function adjustTSPreset(dir: number) {
    const currentIndex = COMMON_TIME_SIGNATURES.findIndex(
      (ts) => ts.label === matchedPreset?.label,
    );
    const nextIndex = currentIndex - dir;
    if (nextIndex >= 0 && nextIndex < COMMON_TIME_SIGNATURES.length) {
      selectPreset(COMMON_TIME_SIGNATURES[nextIndex].label);
    }
  }
}

interface WheelPickerProps {
  value: number;
  options: readonly number[];
  onChange: (value: number) => void;
  ariaLabel: string;
  swipeThreshold?: number;
}

/**
 * A vertical "select wheel": the current value stays centered while its
 * neighbours sit faintly above and below. Scrolling the wheel (or pressing
 * Up/Down) moves the selection toward the neighbour you scroll into; clicking a
 * neighbour jumps straight to it. Works for both the contiguous 1–16 beats and
 * the discrete note values, since it steps through a fixed options array.
 */
function WheelPicker({
  value,
  options,
  onChange,
  ariaLabel,
  swipeThreshold,
}: WheelPickerProps) {
  const index = options.indexOf(value);
  const above = index > 0 ? options[index - 1] : null;
  const below = index < options.length - 1 ? options[index + 1] : null;

  // Wheel up moves to the value shown above; wheel down to the one below.
  const step = (dir: 1 | -1) => {
    const nextIndex = index - dir;
    if (nextIndex >= 0 && nextIndex < options.length) {
      onChange(options[nextIndex]);
    }
  };
  const wheelRef = useWheelAdjust<HTMLDivElement>(step);
  const pointerRef = usePointDragAdjust<HTMLDivElement>(step, {
    threshold: swipeThreshold,
  });
  // Wheel + touch-drag on the same element; memoized so the stable hook refs
  // aren't re-bound on every render.
  const wheelPointerRef = useCallback(
    (el: HTMLDivElement | null) => {
      wheelRef(el);
      pointerRef(el);
    },
    [wheelRef, pointerRef],
  );

  return (
    <div
      className="ts-wheel"
      ref={wheelPointerRef}
      role="spinbutton"
      tabIndex={0}
      aria-valuenow={value}
      aria-valuemin={options[0]}
      aria-valuemax={options[options.length - 1]}
      aria-label={ariaLabel}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          step(1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          step(-1);
        }
      }}
    >
      <span
        className="ts-wheel-option ghost"
        onClick={() => above != null && onChange(above)}
      >
        {above ?? ''}
      </span>
      <span className="ts-wheel-option current">{value}</span>
      <span
        className="ts-wheel-option ghost"
        onClick={() => below != null && onChange(below)}
      >
        {below ?? ''}
      </span>
    </div>
  );
}
