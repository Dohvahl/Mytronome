import { useEffect, useRef, useState } from 'react';

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
