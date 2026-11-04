// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BOARD_SETTINGS, type BoardSettings } from '@bg/ui';
import { Board, PieceIcon } from '../src/ui/Board';
import type { FourState } from '../src/rules/types';
import { at, drops } from './helpers';

afterEach(cleanup);

// Fake translator: returns the key plus its values, so tests can match on both.
const t = (key: string, values?: Record<string, string | number>) =>
  values
    ? `${key} ${Object.entries(values)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')}`
    : key;

function renderBoard(
  view: FourState,
  opts: { isMyTurn?: boolean; disabled?: boolean; settings?: Partial<BoardSettings> } = {},
) {
  const onMove = vi.fn();
  const utils = render(
    <Board
      view={view}
      mySeat={0}
      isMyTurn={opts.isMyTurn ?? true}
      disabled={opts.disabled ?? false}
      onMove={onMove}
      settings={{ ...DEFAULT_BOARD_SETTINGS, ...opts.settings }}
      t={t}
    />,
  );
  return { onMove, ...utils };
}

/** row/col as the player sees them: 1-based, rows counted from the bottom. */
const cellAt = (col: number, row: number) =>
  screen.getByRole('gridcell', { name: new RegExp(` col=${col} row=${row} `) });

describe('Four in a Row board', () => {
  it('renders a labelled cell for every hole, rows counted from the bottom', () => {
    renderBoard(drops([3]));
    expect(
      screen.getByRole('grid', { name: 'games.four-in-a-row.boardLabel columns=7 rows=6' }),
    ).toBeTruthy();
    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
    expect(cellAt(4, 1).getAttribute('data-piece')).toBe('p0');
    expect(cellAt(4, 1).getAttribute('data-last')).toBe('true');
    expect(cellAt(4, 2).getAttribute('aria-label')).toContain('piece=games.four-in-a-row.empty');
  });

  it('clicking any cell of a column drops a piece in that column', () => {
    const { onMove } = renderBoard(drops([]));
    fireEvent.click(cellAt(2, 6)); // top cell of column 2
    expect(onMove).toHaveBeenCalledWith({ col: 1 });
  });

  it('ignores full columns, other players turn and disabled state', () => {
    const full = renderBoard(drops([0, 0, 0, 0, 0, 0]));
    fireEvent.click(cellAt(1, 3));
    expect(full.onMove).not.toHaveBeenCalled();
    cleanup();
    const notMine = renderBoard(drops([]), { isMyTurn: false });
    fireEvent.click(cellAt(1, 1));
    expect(notMine.onMove).not.toHaveBeenCalled();
    cleanup();
    const disabled = renderBoard(drops([]), { disabled: true });
    fireEvent.click(cellAt(1, 1));
    expect(disabled.onMove).not.toHaveBeenCalled();
  });

  it('shows a ghost piece where the piece would land', () => {
    const { container } = renderBoard(drops([2, 2]));
    fireEvent.pointerEnter(cellAt(3, 6));
    const ghost = container.querySelector('.fiar-ghost circle');
    // Column 3 has two pieces, so the ghost sits in row 3 (from the bottom) = index row 3 from the top.
    expect(ghost?.getAttribute('cy')).toBe(String(3 * 40 + 20));
    fireEvent.pointerLeave(container.querySelector('svg')!);
    expect(container.querySelector('.fiar-ghost')).toBeNull();
  });

  it('needs a second tap in the same column when confirmMove is on', () => {
    const { onMove } = renderBoard(drops([]), { settings: { confirmMove: true } });
    fireEvent.click(cellAt(5, 6));
    expect(cellAt(5, 1).getAttribute('data-pending')).toBe('true');
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.click(cellAt(5, 3)); // another cell, same column
    expect(onMove).toHaveBeenCalledWith({ col: 4 });
  });

  it('clears the pending column when the position changes', () => {
    const settings = { ...DEFAULT_BOARD_SETTINGS, confirmMove: true };
    const { rerender } = renderBoard(drops([]), { settings });
    fireEvent.click(cellAt(5, 1));
    rerender(<Board view={drops([0])} mySeat={0} isMyTurn onMove={() => {}} settings={settings} t={t} />);
    expect(screen.getAllByRole('gridcell').some((c) => c.getAttribute('data-pending'))).toBe(false);
  });

  it('marks the winning line and stops accepting moves', () => {
    const { onMove } = renderBoard(drops([0, 0, 1, 1, 2, 2, 3]));
    const win = screen.getAllByRole('gridcell').filter((c) => c.getAttribute('data-win') === 'true');
    expect(win).toHaveLength(4);
    fireEvent.click(cellAt(6, 1));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('animates the last piece falling from the top', () => {
    const { container } = renderBoard(drops([3]));
    const dropping = container.querySelector<SVGGElement>('.fiar-drop');
    expect(dropping?.style.getPropertyValue('--fiar-drop')).toBe(`${-6 * 40}px`);
    cleanup();
    const still = renderBoard(drops([3]), { settings: { animations: false } });
    expect(still.container.querySelector('.fiar-drop')).toBeNull();
  });

  it('announces the last move', () => {
    renderBoard(drops([3, 5]));
    expect(
      screen.getByText('games.four-in-a-row.lastMove piece=games.four-in-a-row.pieces.1 col=6 row=1'),
    ).toBeTruthy();
  });

  it('PieceIcon draws the inner ring only for Red', () => {
    const { container } = render(
      <>
        <PieceIcon seat={0} />
        <PieceIcon seat={1} />
      </>,
    );
    expect(container.querySelectorAll('.fiar-mark')).toHaveLength(1);
    expect(at(0, 0)).toBe(0);
  });
});
