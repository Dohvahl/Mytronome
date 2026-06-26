// @vitest-environment jsdom
import type { Preset } from '@mytronome/presets';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PresetItem } from '../../src/presets/PresetItem';

// Without Vitest's `globals: true`, Testing Library can't auto-unmount between
// tests, so do it by hand — otherwise renders pile up in the shared document.
afterEach(cleanup);

const samplePreset: Preset = {
  id: 'p1',
  label: 'Verse',
  bpm: 120,
  timeSignature: { beats: 4, noteValue: 4 },
  pattern: ['accent', 'normal', 'normal', 'normal'],
  createdAt: 0,
  updatedAt: 0,
};

// Render a PresetItem with every callback stubbed; returns the preset + the
// mocks so a test can assert on them. Pass a partial preset to tweak the fixture.
function setup(presetOverride?: Partial<Preset>) {
  const preset = { ...samplePreset, ...presetOverride };
  const handlers = {
    onLoad: vi.fn(),
    onUpdateToCurrent: vi.fn(),
    onRename: vi.fn(),
    onCopy: vi.fn(),
    onDelete: vi.fn(),
    onDragStart: vi.fn(),
    onDragOver: vi.fn(),
    onDrop: vi.fn(),
    onDragEnd: vi.fn(),
  };
  render(
    <PresetItem
      preset={preset}
      isDragging={false}
      isDropTarget={false}
      {...handlers}
    />,
  );
  return { preset, ...handlers };
}

describe('PresetItem', () => {
  it('shows the preset label', () => {
    setup();
    expect(screen.getByText('Verse')).toBeTruthy();
  });

  it('calls onLoad when the preset row is clicked', () => {
    const { onLoad, preset } = setup();
    fireEvent.click(screen.getByRole('button', { name: /verse/i }));
    expect(onLoad).toHaveBeenCalledWith(preset);
  });

  it('commits a rename on Enter', () => {
    const { onRename, preset } = setup();
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    const input = screen.getByPlaceholderText('Label');
    fireEvent.change(input, { target: { value: 'Chorus' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith(preset, 'Chorus');
  });

  it('cancels a rename on Escape without calling onRename', () => {
    const { onRename } = setup();
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    const input = screen.getByPlaceholderText('Label');
    fireEvent.change(input, { target: { value: 'Chorus' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText('Verse')).toBeTruthy(); // back to display mode
  });

  it('calls onCopy when the duplicate button is clicked', () => {
    const { onCopy, preset } = setup();
    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));
    expect(onCopy).toHaveBeenCalledWith(preset);
  });

  it('calls onDelete when the delete button is clicked', () => {
    const { onDelete, preset } = setup();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(preset);
  });

  it('calls onUpdateToCurrent when the update button is clicked', () => {
    const { onUpdateToCurrent, preset } = setup();
    fireEvent.click(screen.getByRole('button', { name: /update/i }));
    expect(onUpdateToCurrent).toHaveBeenCalledWith(preset);
  });

  it('shows the preset summary when a label is not present', () => {
    setup({ label: '' });
    expect(screen.getByText('120 BPM \u{00B7} 4/4').className).toBe(
      'preset-label',
    );
  });
});
