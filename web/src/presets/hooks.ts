import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

/**
 * A resizable width (e.g. for a left drawer), persisted to localStorage and
 * clamped to [min, max]. Returns the current width and a pointer-down handler
 * to attach to a drag handle on the element's right edge.
 */
export function useResizableWidth(options: {
  storageKey: string;
  defaultWidth: number;
  min: number;
  max: number;
}) {
  const { storageKey, defaultWidth, min, max } = options;

  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(storageKey));
    return Number.isFinite(saved) && saved >= min && saved <= max
      ? saved
      : defaultWidth;
  });

  // Latest width, so the pointer-up handler persists the final value. Assigned
  // in an effect (not during render) per the react-hooks/refs rule.
  const widthRef = useRef(width);
  useEffect(() => {
    widthRef.current = width;
  });

  const onResizeStart = (e: ReactPointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widthRef.current;

    const onMove = (ev: PointerEvent) => {
      const next = Math.min(
        max,
        Math.max(min, startWidth + ev.clientX - startX),
      );
      setWidth(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      localStorage.setItem(storageKey, String(widthRef.current));
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
    };

    // Avoid selecting text / flickering cursor while dragging.
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return { width, onResizeStart };
}
