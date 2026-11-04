// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BOARD_SETTINGS, type BoardSettings } from '@bg/ui';
import { Board, PieceIcon } from '../src/ui/Board';
import type { ReversiState } from '../src/rules/types';
import { at, EMPTY_ROW as E, fromDiagram, play } from './helpers';

afterEach(cleanup);

const t = (key: string, values?: Record<string, string | number>) =>
  values
    ? `${key} ${Object.entries(values)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')}`
    : key;

function renderBoard(
  view: ReversiState,
  opts: { isMyTurn?: boolean; settings?: Partial<BoardSettings> } = {},
) {
  const onMove = vi.fn();
  const utils = render(
    <Board
      view={view}
      mySeat={0}
      isMyTurn={opts.isMyTurn ?? true}
      onMove={onMove}
      settings={{ ...DEFAULT_BOARD_SETTINGS, ...opts.settings }}
      t={t}
    />,
  );
  return { onMove, ...utils };
}

const cellAt = (row: number, col: number) =>
  screen.getByRole('gridcell', { name: new RegExp(` row=${row + 1} col=${col + 1} `) });

describe('Reversi board', () => {
  it('renders the board, the score and marks playable cells', () => {
    renderBoard(play([]));
    expect(screen.getAllByRole('gridcell')).toHaveLength(64);
    expect(screen.getByLabelText('games.reversi.score black=2 white=2')).toBeTruthy();
    const legal = screen.getAllByRole('gridcell').filter((c) => c.getAttribute('data-legal') === 'true');
    expect(legal).toHaveLength(4);
    expect(cellAt(2, 3).getAttribute('aria-label')).toContain('piece=games.reversi.playable');
  });

  it('plays a legal cell and ignores illegal ones', () => {
    const { onMove } = renderBoard(play([]));
    fireEvent.click(cellAt(0, 0));
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.click(cellAt(2, 3));
    expect(onMove).toHaveBeenCalledWith({ cell: at(2, 3) });
  });

  it('shows no hints and accepts no moves when it is not my turn', () => {
    const { onMove, container } = renderBoard(play([]), { isMyTurn: false });
    expect(container.querySelectorAll('[data-legal]')).toHaveLength(0);
    fireEvent.click(cellAt(2, 3));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('hint dots can be turned off', () => {
    const { container } = renderBoard(play([]), { settings: { showLegalMoves: false } });
    expect(container.querySelectorAll('.rv-hint')).toHaveLength(0);
  });

  it('confirmMove needs a second tap; hover shows a ghost disc', () => {
    const { onMove, container } = renderBoard(play([]), { settings: { confirmMove: true } });
    fireEvent.click(cellAt(2, 3));
    expect(onMove).not.toHaveBeenCalled();
    expect(container.querySelectorAll('.rv-ghost')).toHaveLength(1);
    fireEvent.click(cellAt(2, 3));
    expect(onMove).toHaveBeenCalledWith({ cell: at(2, 3) });
  });

  it('animates flipped discs and tells the players about a pass', () => {
    const s = fromDiagram(['BW......', E, E, E, 'BWW.....', E, E, E], 0);
    const after = {
      ...s,
      board: s.board.map((v, i) => (i === 1 || i === 2 ? 0 : v)),
      flipped: [1],
      lastMove: 2,
      passed: 1 as const,
    };
    const { container } = renderBoard(after);
    expect(container.querySelectorAll('.rv-flip')).toHaveLength(1);
    expect(screen.getAllByText('games.reversi.passed piece=games.reversi.pieces.1').length).toBeGreaterThan(
      0,
    );
  });

  it('PieceIcon draws the right colour', () => {
    const { container } = render(<PieceIcon seat={1} />);
    expect(container.querySelector('.rv-p1')).toBeTruthy();
  });
});
