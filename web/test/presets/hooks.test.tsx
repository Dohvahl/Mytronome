// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useResizableWidth } from '../../src/presets/hooks';
import { resetDom } from '../testDom';

/**
 * The drag listens on `window` (so the pointer can leave the thin handle) and
 * persists on release, which makes its contract three separate side effects:
 * the clamped width, the localStorage write, and the body styles that stop text
 * selecting mid-drag. Each is easy to drop in a move, so each is asserted here.
 */

const OPTIONS = {
  storageKey: 'test.width',
  defaultWidth: 340,
  min: 280,
  max: 600,
};

function Harness(props: Partial<typeof OPTIONS> = {}) {
  const { width, onResizeStart } = useResizableWidth({ ...OPTIONS, ...props });
  return (
    <div
      data-testid="handle"
      data-width={width}
      onPointerDown={onResizeStart}
    />
  );
}

/** Drag the handle from x=0 by `dx` pixels, without releasing. */
function drag(handle: HTMLElement, dx: number) {
  fireEvent.pointerDown(handle, { clientX: 0 });
  act(() => {
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: dx }));
  });
}

function release() {
  act(() => {
    window.dispatchEvent(new PointerEvent('pointerup'));
  });
}

beforeEach(resetDom);
afterEach(cleanup);

describe('useResizableWidth initial value', () => {
  it('uses the default when nothing is saved', () => {
    const { getByTestId } = render(<Harness />);
    expect(getByTestId('handle').dataset.width).toBe('340');
  });

  it('restores a saved width', () => {
    localStorage.setItem(OPTIONS.storageKey, '420');
    const { getByTestId } = render(<Harness />);
    expect(getByTestId('handle').dataset.width).toBe('420');
  });

  it('falls back to the default when the saved width is out of range', () => {
    localStorage.setItem(OPTIONS.storageKey, '9999');
    const { getByTestId } = render(<Harness />);
    expect(getByTestId('handle').dataset.width).toBe('340');
  });
});

describe('useResizableWidth dragging', () => {
  it('widens by the pointer distance', () => {
    const { getByTestId } = render(<Harness />);
    const handle = getByTestId('handle');

    drag(handle, 60);

    expect(handle.dataset.width).toBe('400');
  });

  it('clamps to min and max', () => {
    const { getByTestId } = render(<Harness />);
    const handle = getByTestId('handle');

    drag(handle, -500);
    expect(handle.dataset.width).toBe('280');

    release();
    drag(handle, 500);
    expect(handle.dataset.width).toBe('600');
  });

  it('locks text selection during the drag and restores it after', () => {
    const { getByTestId } = render(<Harness />);
    drag(getByTestId('handle'), 20);

    expect(document.body.style.userSelect).toBe('none');
    expect(document.body.style.cursor).toBe('ew-resize');

    release();

    expect(document.body.style.userSelect).toBe('');
    expect(document.body.style.cursor).toBe('');
  });
});

describe('useResizableWidth persistence', () => {
  it('saves the final width on release, not during the drag', () => {
    const { getByTestId } = render(<Harness />);
    const handle = getByTestId('handle');

    drag(handle, 60);
    expect(localStorage.getItem(OPTIONS.storageKey)).toBeNull();

    release();

    expect(localStorage.getItem(OPTIONS.storageKey)).toBe('400');
  });

  it('stops tracking the pointer after release', () => {
    const { getByTestId } = render(<Harness />);
    const handle = getByTestId('handle');
    drag(handle, 60);
    release();

    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 200 }));
    });

    expect(handle.dataset.width).toBe('400'); // unchanged by the stray move
  });
});
