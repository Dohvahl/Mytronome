// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useLayoutMode } from '../../src/metronome/layouts/hooks';
import { resetDom, stubMatchMedia } from './testDom';

/**
 * useLayoutMode's contract is almost entirely SIDE EFFECTS — a localStorage key
 * and an `<html>` attribute that the whole stylesheet keys off. Neither is
 * checked by the compiler, so these tests pin the exact strings: if a refactor
 * retypes 'layout' or 'data-layout', the app silently stops remembering the
 * layout (and every `[data-layout=…]` CSS rule stops matching) with no type error.
 */

beforeEach(() => {
  resetDom();
  stubMatchMedia();
});
afterEach(cleanup);

describe('useLayoutMode persistence', () => {
  it('writes the mode to the "layout" key and <html data-layout>', () => {
    const { result } = renderHook(() => useLayoutMode());

    act(() => result.current[1]('pendulum'));

    expect(localStorage.getItem('layout')).toBe('pendulum');
    expect(document.documentElement.getAttribute('data-layout')).toBe(
      'pendulum',
    );
    expect(result.current[0]).toBe('pendulum');
  });

  it('restores a saved mode on mount', () => {
    localStorage.setItem('layout', 'tower');
    const { result } = renderHook(() => useLayoutMode());
    expect(result.current[0]).toBe('tower');
    expect(document.documentElement.getAttribute('data-layout')).toBe('tower');
  });

  it('ignores an unrecognised saved mode and falls back to the default', () => {
    localStorage.setItem('layout', 'banjo');
    const { result } = renderHook(() => useLayoutMode());
    expect(result.current[0]).toBe('classic');
  });
});

describe('useLayoutMode device default', () => {
  it('defaults to classic on a pointer device', () => {
    stubMatchMedia({ coarse: false });
    const { result } = renderHook(() => useLayoutMode());
    expect(result.current[0]).toBe('classic');
  });

  it('defaults to tower on a touch device', () => {
    stubMatchMedia({ coarse: true });
    const { result } = renderHook(() => useLayoutMode());
    expect(result.current[0]).toBe('tower');
  });

  it('prefers a saved choice over the device default', () => {
    stubMatchMedia({ coarse: true }); // would default to tower
    localStorage.setItem('layout', 'classic');
    const { result } = renderHook(() => useLayoutMode());
    expect(result.current[0]).toBe('classic');
  });
});
