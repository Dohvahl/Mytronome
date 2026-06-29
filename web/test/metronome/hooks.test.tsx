// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePointDragAdjust } from '../../src/metronome/hooks';

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
