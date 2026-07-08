import type { ThemeMode } from './hooks';

interface Props {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Light/dark/system picker — a vertical `.option-stack` of selectable buttons. */
export function ThemeToggle({ mode, onChange }: Props) {
  return (
    <div className="setting-group">
      <span className="setting-label">Theme</span>
      <div className="option-stack" role="radiogroup" aria-label="Theme">
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
