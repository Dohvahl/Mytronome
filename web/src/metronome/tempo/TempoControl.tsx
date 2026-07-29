import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';

interface Props {
  value: number;
  min: number;
  max: number;
  /** Neighbour/step size — 1 normally, 10 while Shift is held (set by parent). */
  step: number;
  onChange: (value: number) => void;
}

/**
 * The tempo readout. Display mode is a bordered "chip" you click to edit. Edit
 * mode is a WheelPicker-style box: a typeable centre value with the adjacent
 * BPM faint above and below. Scrolling is handled by the parent wrapper (so it
 * works in either mode); Enter or clicking away commits, Escape cancels.
 */
export function TempoControl({ value, min, max, step, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus + select the input when edit mode opens.
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Keep the input in sync when the value changes from something other than
  // typing — scrolling, the +/- buttons, or clicking a neighbour.
  useEffect(() => {
    if (editing) setDraft(String(value));
  }, [value, editing]);

  const startEditing = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() !== '' && !Number.isNaN(parsed)) {
      onChange(Math.max(min, Math.min(max, Math.round(parsed))));
    }
    setEditing(false);
  };

  // Reset the draft to the live value before closing, so the input's blur (which
  // also fires commit) becomes a no-op rather than applying half-typed text.
  const cancel = () => {
    setDraft(String(value));
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="bpm-chip"
        onClick={startEditing}
        aria-label={`Tempo ${value} BPM. Click to edit.`}
      >
        {value}
      </button>
    );
  }

  // Neighbours step by `step` (10 with Shift), clamped to the range — so they
  // land where scrolling/the +/- buttons would.
  const higher = value > min ? Math.max(min, value - step) : null; // top
  const lower = value < max ? Math.min(max, value + step) : null; // bottom

  // Clicking a neighbour mustn't blur the input (which would commit + close), so
  // change the value on mousedown with the default prevented to keep focus.
  const nudge = (e: ReactMouseEvent, next: number | null) => {
    e.preventDefault();
    if (next != null) onChange(next);
  };

  return (
    <div className="bpm-wheel">
      <button
        type="button"
        className="bpm-ghost"
        onMouseDown={(e) => nudge(e, lower)}
        tabIndex={-1}
        aria-hidden="true"
      >
        {lower ?? ''}
      </button>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        className="bpm-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') cancel();
        }}
        aria-label="Tempo in BPM"
      />
      <button
        type="button"
        className="bpm-ghost"
        onMouseDown={(e) => nudge(e, higher)}
        tabIndex={-1}
        aria-hidden="true"
      >
        {higher ?? ''}
      </button>
    </div>
  );
}
