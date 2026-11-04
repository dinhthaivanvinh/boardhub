// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BOARD_SETTINGS } from '@bg/ui';
import { Board, PieceIcon } from '../src/ui/Board';
import type { XiangqiState } from '../src/rules/types';
import { at, E, fromDiagram, play } from './helpers';

afterEach(cleanup);

const t = (key: string, values?: Record<string, string | number>) =>
  values
    ? `${key} ${Object.entries(values)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')}`
    : key;

function renderBoard(
  view: XiangqiState,
  opts: { mySeat?: number; isMyTurn?: boolean; orientation?: number } = {},
) {
  const onMove = vi.fn();
  render(
    <Board
      view={view}
      mySeat={opts.mySeat ?? 0}
      isMyTurn={opts.isMyTurn ?? true}
      {...(opts.orientation === undefined ? {} : { orientation: opts.orientation })}
      onMove={onMove}
      settings={DEFAULT_BOARD_SETTINGS}
      t={t}
    />,
  );
  return { onMove };
}

/** A cell as displayed: col 1..9 left to right, row 1..10 from the bottom. */
const shown = (col: number, row: number) =>
  screen.getByRole('gridcell', { name: new RegExp(` col=${col} row=${row} `) });

describe('Xiangqi board', () => {
  it('draws 90 points with Red at the bottom for the Red player', () => {
    renderBoard(play([]));
    expect(screen.getAllByRole('gridcell')).toHaveLength(90);
    expect(shown(5, 1).getAttribute('data-piece')).toBe('rK');
    expect(shown(5, 10).getAttribute('data-piece')).toBe('bK');
    expect(shown(5, 1).getAttribute('aria-label')).toContain(
      'piece=games.xiangqi.pieceLabel type=games.xiangqi.pieceNames.K color=games.xiangqi.pieces.0',
    );
  });

  it('rotates the board for the Black player', () => {
    renderBoard(play([]), { mySeat: 1, isMyTurn: false });
    expect(shown(5, 1).getAttribute('data-piece')).toBe('bK');
    expect(shown(1, 1).getAttribute('data-piece')).toBe('bR');
  });

  it('select a piece, see its targets, then move', () => {
    const { onMove } = renderBoard(play([]));
    fireEvent.click(shown(2, 3)); // red cannon at (7,1)
    expect(shown(2, 3).getAttribute('data-selected')).toBe('true');
    const targets = screen.getAllByRole('gridcell').filter((c) => c.getAttribute('data-target') === 'true');
    expect(targets.length).toBe(12); // 4 up-to-river… the cannon's 12 legal moves at the start
    fireEvent.click(shown(5, 3)); // central cannon
    expect(onMove).toHaveBeenCalledWith({ from: at(7, 1), to: at(7, 4) });
  });

  it('cannot select the opponent pieces or move out of turn', () => {
    const { onMove } = renderBoard(play([]), { isMyTurn: false });
    fireEvent.click(shown(2, 3));
    expect(shown(2, 3).getAttribute('data-selected')).toBeNull();
    cleanup();
    renderBoard(play([]));
    fireEvent.click(shown(1, 10)); // black chariot
    expect(shown(1, 10).getAttribute('data-selected')).toBeNull();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('clicking the selected piece again deselects it', () => {
    renderBoard(play([]));
    fireEvent.click(shown(2, 3));
    fireEvent.click(shown(2, 3));
    expect(shown(2, 3).getAttribute('data-selected')).toBeNull();
  });

  it('marks the last move and a general in check, and announces it', () => {
    const s = fromDiagram(['....k....', E, E, E, E, E, E, E, E, '...K...R.'], 0);
    const checked: XiangqiState = {
      ...s,
      board: s.board.map((p, i) => (i === at(9, 7) ? null : i === at(0, 7) ? 'rR' : p)),
      lastMove: { from: at(9, 7), to: at(0, 7) },
      inCheck: 1,
      turn: 1,
    };
    renderBoard(checked, { isMyTurn: false });
    expect(shown(5, 10).getAttribute('data-check')).toBe('true');
    expect(shown(8, 10).getAttribute('data-last')).toBe('true');
    expect(screen.getByText(/games\.xiangqi\.check/)).toBeTruthy();
  });

  it('PieceIcon shows the general glyph of each side', () => {
    render(
      <>
        <PieceIcon seat={0} />
        <PieceIcon seat={1} />
      </>,
    );
    expect(screen.getByText('帥')).toBeTruthy();
    expect(screen.getByText('將')).toBeTruthy();
  });
});
