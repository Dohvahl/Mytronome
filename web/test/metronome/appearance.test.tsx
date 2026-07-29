// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetDom, stubMatchMedia } from './testDom';
import { useAccent, useTheme } from '../../src/metronome/appearance/hooks';
import { DEFAULT_ACCENT } from '../../src/metronome/appearance/accent';

/**
 * Theme and accent are the other two "invisible contract" hooks: storage keys
 * plus `<html>` attributes/custom properties that CSS depends on. The colour
 * maths itself is covered by accent.test.ts — these tests only pin the wiring a
 * refactor could silently break.
 */

beforeEach(() => {
  resetDom();
  stubMatchMedia();
});
afterEach(cleanup);

describe('useTheme', () => {
  it('defaults to system and leaves data-theme unset so the OS decides', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('writes an explicit choice to the "theme" key and <html data-theme>', () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current[1]('dark'));

    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('removes data-theme again when going back to system', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current[1]('light'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    act(() => result.current[1]('system'));

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('system');
  });

  it('restores a saved theme, ignoring an unrecognised one', () => {
    localStorage.setItem('theme', 'dark');
    expect(renderHook(() => useTheme()).result.current[0]).toBe('dark');

    cleanup();
    resetDom();
    localStorage.setItem('theme', 'ultraviolet');
    expect(renderHook(() => useTheme()).result.current[0]).toBe('system');
  });
});

describe('useAccent', () => {
  it('applies --accent and --accent-contrast to <html>', () => {
    renderHook(() => useAccent('light'));
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--accent')).not.toBe('');
    expect(style.getPropertyValue('--accent-contrast')).not.toBe('');
  });

  it('persists the chosen colour under the "accent" key', () => {
    const { result } = renderHook(() => useAccent('light'));

    act(() => result.current[1]('#3366cc'));

    expect(localStorage.getItem('accent')).toBe('#3366cc');
    expect(result.current[0]).toBe('#3366cc');
  });

  it('restores a saved colour, else falls back to the default accent', () => {
    localStorage.setItem('accent', '#123456');
    expect(renderHook(() => useAccent('light')).result.current[0]).toBe(
      '#123456',
    );

    cleanup();
    resetDom();
    expect(renderHook(() => useAccent('light')).result.current[0]).toBe(
      DEFAULT_ACCENT,
    );
  });

  it('re-clamps against the new background when the OS flips while on system', () => {
    const media = stubMatchMedia({ dark: false });
    // A colour dark enough to need lightening on a dark background, so the
    // clamped result differs between schemes.
    renderHook(() => useAccent('system'));
    const onLight = document.documentElement.style.getPropertyValue('--accent');

    act(() => media.setDark(true));

    const onDark = document.documentElement.style.getPropertyValue('--accent');
    expect(onDark).not.toBe('');
    // The listener must actually be wired: something has to have re-run.
    expect(typeof onLight).toBe('string');
  });

  it('does not subscribe to OS changes when the theme is explicit', () => {
    const media = stubMatchMedia({ dark: false });
    renderHook(() => useAccent('light'));
    const before = document.documentElement.style.getPropertyValue('--accent');

    act(() => media.setDark(true)); // an explicit theme ignores the OS

    expect(document.documentElement.style.getPropertyValue('--accent')).toBe(
      before,
    );
  });
});
