import { useEffect, useRef, useState } from 'react';

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
  const callbackRef = useRef(onStep);
  callbackRef.current = onStep;

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
