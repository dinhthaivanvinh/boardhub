import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GridBoard, VisuallyHidden } from '../src';

afterEach(cleanup);

function setup(overrides: Partial<Parameters<typeof GridBoard>[0]> = {}) {
  const onActivate = vi.fn();
  const onHover = vi.fn();
  render(
    <GridBoard
      rows={3}
      cols={3}
      label="Test board"
      cellLabel={(i) => `cell ${i}`}
      renderCell={(i) => (i === 4 ? <circle data-testid="piece" /> : null)}
      onActivate={onActivate}
      onHover={onHover}
      cellData={(i) => ({ 'data-last': i === 4 ? 'true' : undefined })}
      overlay={<line data-testid="overlay" />}
      {...overrides}
    />,
  );
  return { onActivate, onHover };
}

describe('GridBoard', () => {
  it('renders an accessible grid with one labelled cell per square', () => {
    setup();
    expect(screen.getByRole('grid', { name: 'Test board' })).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getAllByRole('gridcell')).toHaveLength(9);
    expect(screen.getByRole('gridcell', { name: 'cell 4' }).getAttribute('data-last')).toBe('true');
    expect(screen.getByTestId('piece')).toBeTruthy();
    expect(screen.getByTestId('overlay')).toBeTruthy();
  });

  it('only the focused cell is in the tab order, starting at the centre', () => {
    setup();
    const tabbable = screen.getAllByRole('gridcell').filter((c) => c.getAttribute('tabindex') === '0');
    expect(tabbable.map((c) => c.getAttribute('aria-label'))).toEqual(['cell 4']);
  });

  it('click activates a cell and hover reports it', () => {
    const { onActivate, onHover } = setup();
    fireEvent.click(screen.getByRole('gridcell', { name: 'cell 2' }));
    expect(onActivate).toHaveBeenCalledWith(2);
    fireEvent.pointerEnter(screen.getByRole('gridcell', { name: 'cell 7' }));
    expect(onHover).toHaveBeenCalledWith(7);
  });

  it('arrow keys move the focus and Enter/Space activate', () => {
    const { onActivate } = setup();
    const centre = screen.getByRole('gridcell', { name: 'cell 4' });
    fireEvent.keyDown(centre, { key: 'ArrowRight' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('cell 5');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' }); // already at the edge
    expect(document.activeElement?.getAttribute('aria-label')).toBe('cell 5');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('cell 6');
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(onActivate).toHaveBeenLastCalledWith(6);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    fireEvent.keyDown(document.activeElement!, { key: ' ' });
    expect(onActivate).toHaveBeenLastCalledWith(5);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.activeElement!, { key: 'x' }); // ignored
    expect(document.activeElement?.getAttribute('aria-label')).toBe('cell 4');
  });

  it('can hide cell borders and draw a custom background under the cells', () => {
    const { container } = render(
      <GridBoard
        rows={2}
        cols={2}
        label="b"
        cellLabel={(i) => String(i)}
        renderCell={() => null}
        onActivate={() => {}}
        gridLines={false}
        background={<circle data-testid="river" />}
      />,
    );
    expect(container.querySelector('.bg-grid-lines')).toBeNull();
    expect(screen.getByTestId('river')).toBeTruthy();
  });

  it('VisuallyHidden can announce changes politely', () => {
    render(<VisuallyHidden live>hello</VisuallyHidden>);
    expect(screen.getByText('hello').getAttribute('aria-live')).toBe('polite');
  });
});
