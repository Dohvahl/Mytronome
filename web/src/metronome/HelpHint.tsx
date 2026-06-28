import { useEffect, useRef, useState } from 'react';

/**
 * A "?" hint in the top-right corner that reveals the app's non-obvious
 * gestures. It opens on hover/focus (desktop, keyboard) and toggles on click
 * (so it also works on touch, where there's no hover). Escape or a click
 * outside closes a click-opened ("pinned") panel.
 */
export function HelpHint() {
  // Open via hover/focus is transient; open via click is "pinned" until
  // dismissed. The panel shows whenever either is true.
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;

  const containerRef = useRef<HTMLDivElement>(null);

  // While pinned, Escape or a click outside closes the panel.
  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinned(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setPinned(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onClickOutside);
    };
  }, [pinned]);

  return (
    <div
      className="help-hint"
      ref={containerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        className="help-toggle"
        onClick={() => setPinned((p) => !p)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-label="How to use"
        aria-expanded={open}
      >
        <svg
          className="help-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </button>

      {open && (
        <div className="help-panel" role="tooltip">
          <h2 className="help-title">How to use</h2>

          <h3 className="help-group">Tempo</h3>
          <ul className="help-list">
            <li>
              <kbd>Scroll</kbd> over the BPM number or slider to nudge by 1
            </li>
            <li>
              Hold <kbd>Shift</kbd> to step by 10 (buttons and scroll)
            </li>
            <li>
              <kbd>Click</kbd> the BPM to type or scroll an exact value
            </li>
          </ul>

          <h3 className="help-group">Beats</h3>
          <ul className="help-list">
            <li>
              <kbd>Click</kbd> a beat dot to cycle normal → accent → muted
            </li>
          </ul>

          <h3 className="help-group">Time signature</h3>
          <ul className="help-list">
            <li>
              <kbd>Click</kbd> the time signature to open the editor
            </li>
            <li>Scroll the wheels to set the beats and note value</li>
          </ul>

          <h3 className="help-group">Presets</h3>
          <ul className="help-list">
            <li>
              Open the <kbd>&#9776;</kbd> menu to save, load, and reorder
              presets
            </li>
          </ul>

          <p className="help-version">Mytronome v{__APP_VERSION__}</p>
        </div>
      )}
    </div>
  );
}
