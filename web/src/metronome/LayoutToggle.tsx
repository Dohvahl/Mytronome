import type { LayoutMode } from './hooks';

interface Props {
  mode: LayoutMode;
  onChange: (mode: LayoutMode) => void;
}

const OPTIONS: { value: LayoutMode; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'tower', label: 'Tower' },
  { value: 'pendulum', label: 'Pendulum' },
];

/**
 * Layout picker — a vertical `.option-stack` of selectable buttons. Defaults per
 * device (see {@link useLayoutMode}) but lets any arrangement be forced. Lives in
 * the Settings modal.
 */
export function LayoutToggle({ mode, onChange }: Props) {
  return (
    <div className="setting-group">
      <span className="setting-label">Layout</span>
      <div className="option-stack" role="radiogroup" aria-label="Layout">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === mode}
            className="option"
            onClick={() => onChange(o.value)}
          >
            {o.label}
            {o.value === mode && (
              <span className="option-check" aria-hidden="true">
                ✓
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
