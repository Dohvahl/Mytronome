import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns a callback ref that attaches a non-passive `wheel` listener to
 * whatever element it is given. Calls `onStep` with +1 (wheel up) or -1 (wheel
 * down) and prevents the page from scrolling while the pointer is over it.
 *
 * We attach the listener manually rather than using React's `onWheel`, because
 * React registers wheel handlers as "passive," where `preventDefault()` is
 * ignored — so the page would still scroll as you adjusted the value.
 *
 * A callback ref (not a mount-once effect reading `ref.current`) so the listener
 * follows the element when it is swapped out under a persistent hook instance —
 * e.g. switching layouts remounts the tempo controls while this hook lives on in
 * <Metronome>. Binding once to the first element would strand the listener on a
 * removed node, killing wheel adjustment after the first layout change.
 */
export function useWheelAdjust<T extends HTMLElement>(
  onStep: (direction: 1 | -1) => void,
) {
  // Keep the latest callback in a ref so the bound listener always calls the
  // current one; assigned in an effect (not during render) per react-hooks/refs.
  const callbackRef = useRef(onStep);
  useEffect(() => {
    callbackRef.current = onStep;
  });

  // Stable handler, so add/removeEventListener match across element swaps.
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    callbackRef.current(e.deltaY < 0 ? 1 : -1);
  }, []);

  const boundRef = useRef<T | null>(null);
  return useCallback(
    (el: T | null) => {
      if (boundRef.current === el) return;
      boundRef.current?.removeEventListener('wheel', handleWheel);
      boundRef.current = el;
      el?.addEventListener('wheel', handleWheel, { passive: false });
    },
    [handleWheel],
  );
}

interface SwipeOptions {
  threshold?: number;
}

export function usePointDragAdjust<T extends HTMLElement>(
  onSwipe: (direction: 1 | -1) => void,
  { threshold = 12 }: SwipeOptions = {},
) {
  // Latest callback / threshold kept in refs so the window listeners (attached
  // once below) always see current values without re-binding. Assigned in an
  // effect (not during render) per the react-hooks/refs rule.
  const callbackRef = useRef(onSwipe);
  useEffect(() => {
    callbackRef.current = onSwipe;
  }, [onSwipe]);
  const thresholdRef = useRef(threshold);
  useEffect(() => {
    thresholdRef.current = threshold;
  }, [threshold]);

  // The element `pointerdown` is currently bound to (set by the callback ref).
  const boundRef = useRef<T | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const lastYRef = useRef<number | null>(null);

  // The move/up/cancel listeners live on `window` for the hook's lifetime; they
  // read the active element from `boundRef`, so they keep working when the bound
  // element is swapped out (e.g. a layout change remounts the tempo control).
  useEffect(() => {
    const clearGesture = () => {
      const el = boundRef.current;
      if (
        el &&
        activePointerIdRef.current !== null &&
        el.hasPointerCapture(activePointerIdRef.current)
      ) {
        el.releasePointerCapture(activePointerIdRef.current);
      }
      activePointerIdRef.current = null;
      lastYRef.current = null;
    };

    const handlePointerMove = (e: globalThis.PointerEvent) => {
      if (
        activePointerIdRef.current !== e.pointerId ||
        lastYRef.current === null
      ) {
        return;
      }

      const distance = e.clientY - lastYRef.current;
      const threshold = thresholdRef.current;
      const steps = Math.floor(Math.abs(distance) / threshold);

      if (steps > 0) {
        const direction = distance < 0 ? -1 : 1;
        for (let i = 0; i < steps; i += 1) {
          callbackRef.current(direction);
        }
        lastYRef.current += threshold * steps * Math.sign(distance);
      }
    };

    const handlePointerUp = (e: globalThis.PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      clearGesture();
    };

    window.addEventListener('pointermove', handlePointerMove, {
      passive: false,
    });
    window.addEventListener('pointerup', handlePointerUp, { passive: false });
    window.addEventListener('pointercancel', handlePointerUp, {
      passive: false,
    });

    return () => {
      clearGesture();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  // Stable handler, so add/removeEventListener match across element swaps.
  const handlePointerDown = useCallback((e: globalThis.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    if (activePointerIdRef.current !== null) return;
    const el = boundRef.current;
    if (!el) return;

    activePointerIdRef.current = e.pointerId;
    lastYRef.current = e.clientY;
    el.setPointerCapture(e.pointerId);
  }, []);

  return useCallback(
    (el: T | null) => {
      if (boundRef.current === el) return;
      boundRef.current?.removeEventListener('pointerdown', handlePointerDown);
      boundRef.current = el;
      el?.addEventListener('pointerdown', handlePointerDown);
    },
    [handlePointerDown],
  );
}
