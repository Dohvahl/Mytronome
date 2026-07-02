import type { LayoutMode } from './hooks';

interface Props {
  mode: LayoutMode;
  onChange: (mode: LayoutMode) => void;
}

const OPTIONS: { value: LayoutMode; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'tower', label: 'Tower' },
];

/**
 * A segmented switch in the drawer for choosing the overall layout. It defaults
 * per device (see {@link useLayoutMode}) but lets either arrangement be forced
 * on any device. Reuses the `.storage-switch` look from the presets panel.
 */
export function LayoutToggle({ mode, onChange }: Props) {
  return (
    <div className="layout-toggle">
      <span className="layout-toggle-label">Layout</span>
      <div className="storage-switch" role="group" aria-label="Layout">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className={o.value === mode ? 'active' : ''}
            aria-pressed={o.value === mode}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
