import { DEFAULT_ACCENT } from './accent';

interface Props {
  accent: string;
  onChange: (hex: string) => void;
}

/** Free accent-colour picker (native colour input) + a reset-to-brass button. */
export function AccentPicker({ accent, onChange }: Props) {
  const isDefault = accent.toLowerCase() === DEFAULT_ACCENT;
  return (
    <div className="setting-group">
      <span className="setting-label">Accent colour</span>
      <div className="accent-picker">
        <input
          type="color"
          className="accent-swatch"
          value={accent}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Accent colour"
        />
        <span className="accent-value">{accent.toLowerCase()}</span>
        {!isDefault && (
          <button
            type="button"
            className="accent-reset"
            onClick={() => onChange(DEFAULT_ACCENT)}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
