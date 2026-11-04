// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BOARD_SETTINGS, type BoardSettings } from '@bg/ui';
import { Board } from '../src/ui/Board';
import type { CaroState } from '../src/rules/types';
import { at, play } from './helpers';

afterEach(cleanup);

// Fake translator: returns the key plus its values, so tests can match on both.
const t = (key: string, values?: Record<string, string | number>) =>
  values
    ? `${key} ${Object.entries(values)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')}`
    : key;

function renderBoard(
  view: CaroState,
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

const cellAt = (row: number, col: number) =>
  screen.getByRole('gridcell', { name: new RegExp(`row=${row + 1} col=${col + 1} `) });

describe('Caro Board', () => {
  it('renders one labelled cell per square with pieces', () => {
    renderBoard(play({}, [at(7, 7)], [at(7, 8)]));
    expect(screen.getByRole('grid', { name: 'games.caro.boardLabel size=15' })).toBeTruthy();
    expect(screen.getAllByRole('gridcell')).toHaveLength(225);
    expect(cellAt(7, 7).getAttribute('aria-label')).toContain('piece=games.caro.pieces.0');
    expect(cellAt(7, 8).getAttribute('data-piece')).toBe('o');
    expect(cellAt(7, 8).getAttribute('data-last')).toBe('true');
    expect(cellAt(0, 0).getAttribute('aria-label')).toContain('piece=games.caro.empty');
  });

  it('plays a move when an empty cell is clicked on my turn', () => {
    const { onMove } = renderBoard(play({}, [], []));
    fireEvent.click(cellAt(3, 4));
    expect(onMove).toHaveBeenCalledWith({ cell: at(3, 4) });
  });

  it.each([
    ['not my turn', { isMyTurn: false }],
    ['disabled', { disabled: true }],
  ])('ignores clicks when %s', (_name, opts) => {
    const { onMove } = renderBoard(play({}, [], []), opts);
    fireEvent.click(cellAt(3, 4));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('ignores clicks on an occupied cell', () => {
    const { onMove } = renderBoard(play({}, [at(7, 7)], []), {});
    fireEvent.click(cellAt(7, 7));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('needs a second tap on the same cell when confirmMove is on', () => {
    const { onMove } = renderBoard(play({}, [], []), { settings: { confirmMove: true } });
    fireEvent.click(cellAt(1, 1));
    expect(cellAt(1, 1).getAttribute('data-pending')).toBe('true');
    fireEvent.click(cellAt(2, 2)); // change of mind
    expect(cellAt(1, 1).getAttribute('data-pending')).toBeNull();
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.click(cellAt(2, 2));
    expect(onMove).toHaveBeenCalledWith({ cell: at(2, 2) });
  });

  it('clears the pending cell when the position changes', () => {
    const view = play({}, [], []);
    const { rerender } = renderBoard(view, { settings: { confirmMove: true } });
    fireEvent.click(cellAt(1, 1));
    rerender(
      <Board
        view={play({}, [at(7, 7)], [])}
        mySeat={0}
        isMyTurn
        onMove={() => {}}
        settings={{ ...DEFAULT_BOARD_SETTINGS, confirmMove: true }}
        t={t}
      />,
    );
    expect(cellAt(1, 1).getAttribute('data-pending')).toBeNull();
  });

  it('shows a ghost piece on hover', () => {
    const { container } = renderBoard(play({}, [], []));
    fireEvent.pointerEnter(cellAt(5, 5));
    expect(container.querySelectorAll('.caro-ghost')).toHaveLength(1);
  });

  it('highlights the winning line and stops accepting moves', () => {
    const won = play({}, [at(7, 3), at(7, 4), at(7, 5), at(7, 6), at(7, 7)], [0, 2, 4, 6]);
    const { onMove, container } = renderBoard(won);
    expect(screen.getAllByRole('gridcell').filter((c) => c.getAttribute('data-win') === 'true')).toHaveLength(
      5,
    );
    expect(container.querySelector('.caro-win-line')).toBeTruthy();
    fireEvent.click(cellAt(10, 10));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('announces the last move for screen readers', () => {
    renderBoard(play({}, [at(0, 0)], []));
    expect(screen.getByText('games.caro.lastMove piece=games.caro.pieces.0 row=1 col=1')).toBeTruthy();
  });
});
