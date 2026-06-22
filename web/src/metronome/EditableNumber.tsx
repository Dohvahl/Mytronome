import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * Shows a number as plain text. Double-clicking turns it into an input you can
 * type in; Enter (or clicking away) commits the value clamped to [min, max],
 * and Escape cancels.
 */
export function EditableNumber({
  value,
  min,
  max,
  onCommit,
  className,
  ariaLabel,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // When we enter edit mode, focus the input and pre-select its contents.
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() !== '' && !Number.isNaN(parsed)) {
      onCommit(Math.max(min, Math.min(max, Math.round(parsed))));
    }
    setEditing(false);
  };

  const classes = ['editable-number', className].filter(Boolean).join(' ');

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        className={classes}
        value={draft}
        min={min}
        max={max}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') setEditing(false);
        }}
        onBlur={commit}
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <span
      className={classes}
      onDoubleClick={startEditing}
      role="spinbutton"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={ariaLabel}
      title="Double-click to type a value"
    >
      {value}
    </span>
  );
}
