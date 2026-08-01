// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NumberField } from '../../src/metronome/NumberField';

/**
 * NumberField is shared by the tempo readout and the ramp's two fields, so a
 * regression here breaks both. These cover the contract each of them relies on:
 * clamping, the commit/cancel keys, and the wheel gesture.
 */

afterEach(cleanup);

function setup(props: Partial<Parameters<typeof NumberField>[0]> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <NumberField
      name="Tempo"
      label="BPM"
      value={120}
      min={40}
      max={320}
      step={1}
      onChange={onChange}
      {...props}
    />,
  );
  return { ...utils, onChange };
}

/** The display-mode chip (edit mode replaces it with the input). */
const chip = (c: HTMLElement) => c.querySelector('.number-chip') as HTMLElement;
const input = (c: HTMLElement) =>
  c.querySelector('.number-input') as HTMLInputElement;

describe('display mode', () => {
  it('shows the value and the unit caption', () => {
    const { container, getByText } = setup();
    expect(chip(container).textContent).toBe('120');
    expect(getByText('BPM')).toBeTruthy();
  });

  it('omits the caption when no label is given', () => {
    const { container } = setup({ label: undefined });
    expect(container.querySelector('.number-field-label')).toBeNull();
  });

  it('names the field for screen readers', () => {
    const { container } = setup();
    expect(chip(container).getAttribute('aria-label')).toContain('Tempo 120');
  });
});

describe('editing', () => {
  it('swaps to an input on click, seeded with the current value', () => {
    const { container } = setup();
    fireEvent.click(chip(container));
    expect(input(container).value).toBe('120');
  });

  it('commits a typed value on Enter', () => {
    const { container, onChange } = setup();
    fireEvent.click(chip(container));
    fireEvent.change(input(container), { target: { value: '150' } });
    fireEvent.keyDown(input(container), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(150);
  });

  it('commits on blur too', () => {
    const { container, onChange } = setup();
    fireEvent.click(chip(container));
    fireEvent.change(input(container), { target: { value: '90' } });
    fireEvent.blur(input(container));
    expect(onChange).toHaveBeenCalledWith(90);
  });

  it('discards the draft on Escape', () => {
    const { container, onChange } = setup();
    fireEvent.click(chip(container));
    fireEvent.change(input(container), { target: { value: '200' } });
    fireEvent.keyDown(input(container), { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects non-digits as they are typed', () => {
    const { container } = setup();
    fireEvent.click(chip(container));
    fireEvent.change(input(container), { target: { value: '1a2b' } });
    expect(input(container).value).toBe('12');
  });

  it('ignores an empty entry rather than committing NaN', () => {
    const { container, onChange } = setup();
    fireEvent.click(chip(container));
    fireEvent.change(input(container), { target: { value: '' } });
    fireEvent.keyDown(input(container), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('clamping', () => {
  it.each([
    ['above max', '999', 320],
    ['below min', '5', 40],
  ])('clamps a typed value %s', (_label, typed, expected) => {
    const { container, onChange } = setup();
    fireEvent.click(chip(container));
    fireEvent.change(input(container), { target: { value: typed } });
    fireEvent.keyDown(input(container), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(expected);
  });
});

describe('wheel gesture', () => {
  const wheel = (el: Element, deltaY: number) =>
    el.dispatchEvent(
      new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }),
    );

  it('raises the value on wheel up and lowers it on wheel down', () => {
    const { container, onChange } = setup({ value: 120, step: 1 });
    const field = container.querySelector('.number-field')!;

    wheel(field, -100);
    expect(onChange).toHaveBeenLastCalledWith(121);

    wheel(field, 100);
    expect(onChange).toHaveBeenLastCalledWith(119);
  });

  it('moves by `step`, so the parent can boost it', () => {
    const { container, onChange } = setup({ value: 120, step: 10 });
    wheel(container.querySelector('.number-field')!, -100);
    expect(onChange).toHaveBeenLastCalledWith(130);
  });

  it('clamps at the range ends', () => {
    const { container, onChange } = setup({ value: 320, step: 10 });
    wheel(container.querySelector('.number-field')!, -100);
    expect(onChange).toHaveBeenLastCalledWith(320);
  });

  it('scrolling the caption adjusts too, not just the number', () => {
    const { onChange, getByText } = setup({ value: 120 });
    wheel(getByText('BPM'), -100);
    expect(onChange).toHaveBeenLastCalledWith(121);
  });
});
