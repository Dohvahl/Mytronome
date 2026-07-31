import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { usePointDragAdjust, useWheelAdjust } from './gestures';

interface Props {
  value: number;
  min: number;
  max: number;
  /**
   * How far one wheel notch, drag step, or ghost click moves the value. The
   * parent decides it, which is how the tempo gets its Shift-held ±10 without
   * this control knowing anything about modifier keys.
   */
  step: number;
  onChange: (value: number) => void;
  /** What the field holds, for screen readers — e.g. "Tempo". */
  name: string;
  /** Optional unit caption under the value, e.g. "BPM". Part of the drag target. */
  label?: string;
  /** Extra class on the wrapper, so a consumer can size it. */
  className?: string;
}

/**
 * An editable number: a bordered "chip" you click to type into, which becomes a
 * wheel-picker-style box with the neighbouring values faint above and below.
 * Scrolling or dragging anywhere over it — including the unit caption — nudges
 * the value by `step`.
 *
 * Shared rather than tempo-specific: the tempo readout and the ramp's "after N
 * bars" / "increase by N BPM" fields are the same control at different sizes.
 * Sizing lives with each consumer (see `.tempo-field` in tempo.css); everything
 * structural lives here and in numberField.css.
 */
export function NumberField({
  value,
  min,
  max,
  step,
  onChange,
  name,
  label,
  className,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));

  // Wheel and touch-drag both nudge by `step`. Attached to the wrapper so the
  // unit caption is part of the target, not just the number.
  const nudge = (direction: 1 | -1) =>
    onChange(clamp(value + direction * step));
  const wheelRef = useWheelAdjust<HTMLDivElement>(nudge);
  const pointerRef = usePointDragAdjust<HTMLDivElement>(nudge);
  // Both hooks return callback refs, so merge them for the one element; memoized
  // so a re-render doesn't detach and re-attach the listeners.
  const fieldRef = useCallback(
    (el: HTMLDivElement | null) => {
      wheelRef(el);
      pointerRef(el);
    },
    [wheelRef, pointerRef],
  );

  // Focus + select the input when edit mode opens.
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Keep the input in sync when the value changes from something other than
  // typing — scrolling, dragging, the +/- buttons, or clicking a neighbour.
  useEffect(() => {
    if (editing) setDraft(String(value));
  }, [value, editing]);

  const startEditing = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() !== '' && !Number.isNaN(parsed)) onChange(clamp(parsed));
    setEditing(false);
  };

  // Reset the draft to the live value before closing, so the input's blur (which
  // also fires commit) becomes a no-op rather than applying half-typed text.
  const cancel = () => {
    setDraft(String(value));
    setEditing(false);
  };

  // Neighbours step by `step`, clamped to the range — so they land where
  // scrolling and the +/- buttons would.
  const higher = value > min ? Math.max(min, value - step) : null; // shown on top
  const lower = value < max ? Math.min(max, value + step) : null; // shown below

  // Clicking a neighbour mustn't blur the input (which would commit + close), so
  // change the value on mousedown with the default prevented, to keep focus.
  const nudgeTo = (e: ReactMouseEvent, next: number | null) => {
    e.preventDefault();
    if (next != null) onChange(next);
  };

  return (
    <div className={`number-field ${className ?? ''}`} ref={fieldRef}>
      <div className="number-field-value">
        {editing ? (
          <div className="number-wheel">
            <button
              type="button"
              className="number-ghost"
              onMouseDown={(e) => nudgeTo(e, lower)}
              tabIndex={-1}
              aria-hidden="true"
            >
              {lower ?? ''}
            </button>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              className="number-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                else if (e.key === 'Escape') cancel();
              }}
              aria-label={name}
            />
            <button
              type="button"
              className="number-ghost"
              onMouseDown={(e) => nudgeTo(e, higher)}
              tabIndex={-1}
              aria-hidden="true"
            >
              {higher ?? ''}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="number-chip"
            onClick={startEditing}
            aria-label={`${name} ${value}${label ? ` ${label}` : ''}. Click to edit.`}
          >
            {value}
          </button>
        )}
      </div>
      {label && <span className="number-field-label">{label}</span>}
    </div>
  );
}
