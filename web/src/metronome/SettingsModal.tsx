import './Settings.css';
import type { LayoutMode, ThemeMode } from './hooks';
import { ThemeToggle } from './ThemeToggle';
import { LayoutToggle } from './LayoutToggle';
import { AccentPicker } from './AccentPicker';

interface Props {
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  layout: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  accent: string;
  onAccentChange: (hex: string) => void;
  onClose: () => void;
}

/** Appearance settings (theme, layout, accent) in a centered modal — mirrors the
 *  account/time-signature modal pattern (backdrop click-away + close button). */
export function SettingsModal({
  theme,
  onThemeChange,
  layout,
  onLayoutChange,
  accent,
  onAccentChange,
  onClose,
}: Props) {
  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="settings-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="settings-title">Settings</h2>
        <ThemeToggle mode={theme} onChange={onThemeChange} />
        <LayoutToggle mode={layout} onChange={onLayoutChange} />
        <AccentPicker accent={accent} onChange={onAccentChange} />
      </div>
    </div>
  );
}
