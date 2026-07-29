import { useLayoutEffect, useState } from 'react';

/** The overall arrangements of the metronome. */
export type LayoutMode = 'classic' | 'tower' | 'pendulum';

const LAYOUT_KEY = 'layout';
const LAYOUTS: readonly LayoutMode[] = ['classic', 'tower', 'pendulum'];

/**
 * The default arrangement for a device: touch devices (phones) get the vertical
 * "tower" layout, pointer devices the classic horizontal one. Either can be
 * overridden — {@link useLayoutMode} remembers the choice. (Pendulum is opt-in.)
 */
function defaultLayout(): LayoutMode {
  return window.matchMedia('(pointer: coarse)').matches ? 'tower' : 'classic';
}

/**
 * The active layout mode, persisted to localStorage and mirrored onto
 * `<html data-layout>` so CSS can switch the whole arrangement off one attribute
 * (the same shape the theme system uses). Returns the mode and a setter.
 */
export function useLayoutMode(): [LayoutMode, (mode: LayoutMode) => void] {
  const [mode, setMode] = useState<LayoutMode>(() => {
    const saved = localStorage.getItem(LAYOUT_KEY) as LayoutMode | null;
    return saved && LAYOUTS.includes(saved) ? saved : defaultLayout();
  });

  // useLayoutEffect so the attribute is set before the browser paints — a phone
  // defaulting to "tower" never flashes the classic layout first.
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-layout', mode);
    localStorage.setItem(LAYOUT_KEY, mode);
  }, [mode]);

  return [mode, setMode];
}
