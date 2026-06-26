import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

/**
 * Attaches a non-passive `wheel` listener to the returned ref. Calls `onStep`
 * with +1 (wheel up) or -1 (wheel down) and prevents the page from scrolling
 * while the pointer is over the element.
 *
 * We attach the listener manually rather than using React's `onWheel`, because
 * React registers wheel handlers as "passive," where `preventDefault()` is
 * ignored — so the page would still scroll as you adjusted the value.
 */
export function useWheelAdjust<T extends HTMLElement>(
  onStep: (direction: 1 | -1) => void,
) {
  const ref = useRef<T>(null);
  // Keep the latest callback in a ref so we attach the listener only once.
  // Assigned in an effect (not during render) per the react-hooks/refs rule.
  const callbackRef = useRef(onStep);
  useEffect(() => {
    callbackRef.current = onStep;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      callbackRef.current(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  return ref;
}

/**
 * Tracks whether a given key (e.g. 'Shift') is currently held down, so the UI
 * can react live. Resets on window blur so the held state can't get "stuck" if
 * the key is released while the window is unfocused.
 */
export function useKeyHeld(targetKey: string): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === targetKey) setHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === targetKey) setHeld(false);
    };
    const reset = () => setHeld(false);

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', reset);
    };
  }, [targetKey]);

  return held;
}

/**
 * Calls `onPress` when `targetKey` is pressed while the app window has focus —
 * but not while typing in a field or when a button/link is focused, so e.g.
 * Space can toggle the metronome from anywhere without hijacking text input or
 * double-firing a focused button. Ignores auto-repeat from a held key.
 */
export function useKeyPressed(targetKey: string, onPress: () => void): void {
  // Latest callback in a ref so we attach the listener only once (same pattern
  // as useWheelAdjust). Assigned in an effect per the react-hooks/refs rule.
  const callbackRef = useRef(onPress);
  useEffect(() => {
    callbackRef.current = onPress;
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key !== targetKey) return;
      if (e.repeat) return; // holding the key shouldn't toggle repeatedly
      const target = e.target as HTMLElement | null;
      // Let the key type / activate natively when a field or button is focused.
      if (
        target?.closest(
          'input, textarea, select, button, [role="button"], a[href], [contenteditable]',
        )
      ) {
        return;
      }
      e.preventDefault(); // space otherwise scrolls the page
      callbackRef.current();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [targetKey]);
}

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
