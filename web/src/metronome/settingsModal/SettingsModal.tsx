import { AccentPicker } from '../appearance/AccentPicker';
import type { ThemeMode } from '../appearance/hooks';
import { ThemeToggle } from '../appearance/ThemeToggle';
import type { LayoutMode } from '../layouts/hooks';
import { LayoutToggle } from '../layouts/LayoutToggle';
import './Settings.css';

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
