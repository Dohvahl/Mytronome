import { useTheme } from './useTheme';
import './ThemePicker.css';

/**
 * Lets the user pick a visual theme. Minimal on purpose — restyle freely (e.g.
 * into material swatches). The actual look of each theme lives in CSS.
 */
export function ThemePicker() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="theme-picker">
      <h2 className="theme-picker-title">Theme</h2>
      <div className="theme-picker-options" role="radiogroup" aria-label="Theme">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={theme === t.id}
            className={`theme-option ${theme === t.id ? 'selected' : ''}`}
            onClick={() => setTheme(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
