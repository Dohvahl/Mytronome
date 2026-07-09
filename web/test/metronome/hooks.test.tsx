// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePointDragAdjust, useWheelAdjust } from '../../src/metronome/hooks';

afterEach(() => cleanup());

function HookHarness({ onSwipe }: { onSwipe: (direction: 1 | -1) => void }) {
  const ref = usePointDragAdjust<HTMLDivElement>(onSwipe);
  return <div ref={ref} data-testid="tempo-target" />;
}

describe('usePointDragAdjust', () => {
  it('tracks swipe gestures across the window and stops on pointer release', () => {
    const onSwipe = vi.fn();
    const { getByTestId } = render(<HookHarness onSwipe={onSwipe} />);
    const target = getByTestId('tempo-target') as HTMLElement;

    let activePointerId: number | null = null;
    Object.defineProperty(target, 'setPointerCapture', {
      configurable: true,
      value: vi.fn((pointerId: number) => {
        activePointerId = pointerId;
      }),
    });
    Object.defineProperty(target, 'releasePointerCapture', {
      configurable: true,
      value: vi.fn(() => {
        activePointerId = null;
      }),
    });
    Object.defineProperty(target, 'hasPointerCapture', {
      configurable: true,
      value: vi.fn((pointerId: number) => activePointerId === pointerId),
    });

    target.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        clientY: 100,
        pointerType: 'touch',
        bubbles: true,
      }),
    );

    window.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientY: 70,
        pointerType: 'touch',
        bubbles: true,
      }),
    );

    window.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientY: 40,
        pointerType: 'touch',
        bubbles: true,
      }),
    );

    window.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: 1,
        clientY: 40,
        pointerType: 'touch',
        bubbles: true,
      }),
    );

    const callsBeforeRelease = onSwipe.mock.calls.length;

    window.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientY: 20,
        pointerType: 'touch',
        bubbles: true,
      }),
    );

    expect(onSwipe).toHaveBeenCalledWith(-1);
    expect(onSwipe.mock.calls.length).toBeGreaterThan(1);
    expect(onSwipe.mock.calls.length).toBe(callsBeforeRelease);
  });

  it('reverses direction when the swipe changes direction before release', () => {
    const onSwipe = vi.fn();
    const { getByTestId } = render(<HookHarness onSwipe={onSwipe} />);
    const target = getByTestId('tempo-target') as HTMLElement;

    let activePointerId: number | null = null;
    Object.defineProperty(target, 'setPointerCapture', {
      configurable: true,
      value: vi.fn((pointerId: number) => {
        activePointerId = pointerId;
      }),
    });
    Object.defineProperty(target, 'releasePointerCapture', {
      configurable: true,
      value: vi.fn(() => {
        activePointerId = null;
      }),
    });
    Object.defineProperty(target, 'hasPointerCapture', {
      configurable: true,
      value: vi.fn((pointerId: number) => activePointerId === pointerId),
    });

    target.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        clientY: 100,
        pointerType: 'touch',
        bubbles: true,
      }),
    );

    window.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientY: 70,
        pointerType: 'touch',
        bubbles: true,
      }),
    );

    window.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientY: 100,
        pointerType: 'touch',
        bubbles: true,
      }),
    );

    expect(onSwipe.mock.calls.map(([direction]) => direction)).toEqual(
      expect.arrayContaining([-1, 1]),
    );
  });
});

describe('useWheelAdjust', () => {
  // A single hook instance whose target element is swapped between two DOM nodes
  // — the shape that broke tempo scrolling after a layout change: the hook lives
  // in <Metronome> while the layout branches remount the display element.
  function SwapHarness({ onStep }: { onStep: (direction: 1 | -1) => void }) {
    const wheelRef = useWheelAdjust<HTMLDivElement>(onStep);
    const [swapped, setSwapped] = useState(false);
    return swapped ? (
      <div ref={wheelRef} data-testid="second" data-swapped="true">
        <button onClick={() => setSwapped(false)}>back</button>
      </div>
    ) : (
      <div ref={wheelRef} data-testid="first">
        <button onClick={() => setSwapped(true)}>swap</button>
      </div>
    );
  }

  it('follows the element when it is swapped under a persistent hook', () => {
    const onStep = vi.fn();
    const { getByTestId, getByText } = render(<SwapHarness onStep={onStep} />);

    getByTestId('first').dispatchEvent(
      new WheelEvent('wheel', { deltaY: -10, bubbles: true, cancelable: true }),
    );
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenLastCalledWith(1);

    // Swap the element (as a layout change would), then wheel over the new one.
    fireEvent.click(getByText('swap'));
    getByTestId('second').dispatchEvent(
      new WheelEvent('wheel', { deltaY: 10, bubbles: true, cancelable: true }),
    );
    expect(onStep).toHaveBeenCalledTimes(2);
    expect(onStep).toHaveBeenLastCalledWith(-1);
  });
});
