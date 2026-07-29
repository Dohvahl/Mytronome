// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useKeyHeld, useKeyPressed } from '../../src/metronome/hooks';

/**
 * Both hooks listen on `window`, so events are dispatched from a real element
 * and allowed to bubble — the same path a keypress takes in the app (a keyboard
 * event always targets the focused element, never the window itself, which is
 * what useKeyPressed's `target.closest(...)` guard relies on).
 */

afterEach(cleanup);

describe('useKeyHeld', () => {
  it('tracks the key going down and back up', () => {
    const { result } = renderHook(() => useKeyHeld('Shift'));
    expect(result.current).toBe(false);

    fireEvent.keyDown(document.body, { key: 'Shift' });
    expect(result.current).toBe(true);

    fireEvent.keyUp(document.body, { key: 'Shift' });
    expect(result.current).toBe(false);
  });

  it('ignores other keys', () => {
    const { result } = renderHook(() => useKeyHeld('Shift'));
    fireEvent.keyDown(document.body, { key: 'Control' });
    expect(result.current).toBe(false);
  });

  it('resets on window blur so the key cannot stick', () => {
    const { result } = renderHook(() => useKeyHeld('Shift'));
    fireEvent.keyDown(document.body, { key: 'Shift' });
    expect(result.current).toBe(true);

    // Released while another window had focus: the keyup never reaches us.
    fireEvent.blur(window);

    expect(result.current).toBe(false);
  });

  it('stops listening once unmounted', () => {
    const { result, unmount } = renderHook(() => useKeyHeld('Shift'));
    unmount();
    fireEvent.keyDown(document.body, { key: 'Shift' });
    expect(result.current).toBe(false);
  });
});

describe('useKeyPressed', () => {
  it('calls back on the target key and prevents its default', () => {
    const onPress = vi.fn();
    renderHook(() => useKeyPressed(' ', onPress));

    const prevented = !fireEvent.keyDown(document.body, { key: ' ' });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(prevented).toBe(true); // space must not scroll the page
  });

  it('ignores other keys and auto-repeat from a held key', () => {
    const onPress = vi.fn();
    renderHook(() => useKeyPressed(' ', onPress));

    fireEvent.keyDown(document.body, { key: 'a' });
    fireEvent.keyDown(document.body, { key: ' ', repeat: true });

    expect(onPress).not.toHaveBeenCalled();
  });

  it.each([
    ['input', <input key="i" />],
    ['textarea', <textarea key="t" />],
    ['button', <button key="b">go</button>],
  ])('does not fire while a %s has focus', (_name, element) => {
    const onPress = vi.fn();
    renderHook(() => useKeyPressed(' ', onPress));
    const { container } = render(element);

    fireEvent.keyDown(container.firstElementChild!, { key: ' ' });

    expect(onPress).not.toHaveBeenCalled();
  });

  it('uses the latest callback without re-subscribing', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => useKeyPressed(' ', fn), {
      initialProps: { fn: first },
    });

    rerender({ fn: second });
    fireEvent.keyDown(document.body, { key: ' ' });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops listening once unmounted', () => {
    const onPress = vi.fn();
    const { unmount } = renderHook(() => useKeyPressed(' ', onPress));
    unmount();
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(onPress).not.toHaveBeenCalled();
  });
});
