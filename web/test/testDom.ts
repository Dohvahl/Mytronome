/**
 * Shared jsdom helpers for hook tests.
 *
 * jsdom implements neither `matchMedia` nor any concept of an OS colour scheme,
 * but several hooks branch on both — so tests install a stub and choose what it
 * reports. Keeping it here means the layout and appearance suites can't drift
 * apart on how they fake the environment.
 */

interface MediaStub {
  /** Flip the stubbed OS preference and notify anything listening. */
  setDark(dark: boolean): void;
}

/**
 * Install a `window.matchMedia` stub. `coarse` decides what
 * `(pointer: coarse)` reports (i.e. touch vs mouse); `dark` seeds
 * `(prefers-color-scheme: dark)`, which {@link MediaStub.setDark} can change
 * later to simulate the OS switching themes while the app is open.
 */
export function stubMatchMedia({
  coarse = false,
  dark = false,
}: { coarse?: boolean; dark?: boolean } = {}): MediaStub {
  let isDark = dark;
  const listeners = new Set<() => void>();

  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      if (query.includes('prefers-color-scheme: dark')) return isDark;
      if (query.includes('pointer: coarse')) return coarse;
      return false;
    },
    addEventListener: (_: string, fn: () => void) => void listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) =>
      void listeners.delete(fn),
    // Legacy API, present so anything calling it doesn't explode.
    addListener: (fn: () => void) => void listeners.add(fn),
    removeListener: (fn: () => void) => void listeners.delete(fn),
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia;

  return {
    setDark(next: boolean) {
      isDark = next;
      listeners.forEach((fn) => fn());
    },
  };
}

/** Reset the globals these hooks write to, so tests can't leak into each other. */
export function resetDom(): void {
  localStorage.clear();
  const root = document.documentElement;
  root.removeAttribute('data-layout');
  root.removeAttribute('data-theme');
  root.style.removeProperty('--accent');
  root.style.removeProperty('--accent-contrast');
  document.body.style.removeProperty('user-select');
  document.body.style.removeProperty('cursor');
}
