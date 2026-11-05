// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BOARD_SETTINGS } from '@bg/ui';
import { Board, PieceIcon } from '../src/ui/Board';
import { definition } from '../src/rules/definition';
import type { CoGanhState } from '../src/rules/types';
import { at, fromDiagram, play } from './helpers';

afterEach(cleanup);

const t = (key: string, values?: Record<string, string | number>) =>
  values
    ? `${key} ${Object.entries(values)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')}`
    : key;

function renderBoard(view: CoGanhState, opts: { mySeat?: number; isMyTurn?: boolean } = {}) {
  const onMove = vi.fn();
  render(
    <Board
      view={view}
      mySeat={opts.mySeat ?? 0}
      isMyTurn={opts.isMyTurn ?? true}
      onMove={onMove}
      settings={DEFAULT_BOARD_SETTINGS}
      t={t}
    />,
  );
  return { onMove };
}

/** A point as displayed: col 1..5 left to right, row 1..5 from the bottom. */
const shown = (col: number, row: number) =>
  screen.getByRole('gridcell', { name: new RegExp(` col=${col} row=${row} `) });

describe('Cờ gánh board', () => {
  it('draws 25 points with Red at the bottom for Red', () => {
    renderBoard(play([]));
    expect(screen.getAllByRole('gridcell')).toHaveLength(25);
    expect(shown(1, 1).getAttribute('data-piece')).toBe('0');
    expect(shown(1, 5).getAttribute('data-piece')).toBe('1');
    expect(shown(3, 3).getAttribute('data-strong')).toBe('true');
    expect(shown(2, 3).getAttribute('data-strong')).toBeNull();
  });

  it('turns the board round for Blue', () => {
    renderBoard(play([]), { mySeat: 1, isMyTurn: false });
    expect(shown(1, 1).getAttribute('data-piece')).toBe('1');
    expect(shown(5, 3).getAttribute('data-piece')).toBe('0'); // Red's middle-row piece, seen from Blue
  });

  it('select a piece, see where it can go, then move', () => {
    const { onMove } = renderBoard(play([]));
    fireEvent.click(shown(3, 1)); // (4,2), a strong point
    expect(shown(3, 1).getAttribute('data-selected')).toBe('true');
    const targets = screen.getAllByRole('gridcell').filter((c) => c.getAttribute('data-target') === 'true');
    expect(targets).toHaveLength(3);
    fireEvent.click(shown(3, 2));
    expect(onMove).toHaveBeenCalledWith({ from: at(4, 2), to: at(3, 2) });
  });

  it('cannot pick the opponent pieces, pieces that cannot move, or play out of turn', () => {
    const { onMove } = renderBoard(play([]));
    fireEvent.click(shown(1, 5)); // Blue
    expect(shown(1, 5).getAttribute('data-selected')).toBeNull();
    cleanup();
    // Under "mở" only the forced move is allowed: Red's other pieces cannot be picked.
    renderBoard(fromDiagram(['.....', '.R...', 'B.B..', '.....', 'B.R.B'], 0, at(2, 1)));
    fireEvent.click(shown(3, 1)); // Red on (4,2) is not next to the forced point
    expect(shown(3, 1).getAttribute('data-selected')).toBeNull();
    fireEvent.click(shown(2, 4)); // Red on (1,1) can
    expect(shown(2, 4).getAttribute('data-selected')).toBe('true');
    cleanup();
    renderBoard(play([]), { isMyTurn: false });
    fireEvent.click(shown(3, 1));
    expect(shown(3, 1).getAttribute('data-selected')).toBeNull();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('clicking the selected piece again deselects it', () => {
    renderBoard(play([]));
    fireEvent.click(shown(3, 1));
    fireEvent.click(shown(3, 1));
    expect(shown(3, 1).getAttribute('data-selected')).toBeNull();
  });

  it('marks the last move, the changed pieces and the forced point, and announces the carry', () => {
    const s = fromDiagram(['.....', '.B...', 'RRR..', '.....', 'B...B'], 0);
    const after = { ...s, board: s.board.map((v, i) => (i === at(2, 1) ? null : i === at(3, 1) ? 0 : v)) };
    const view: CoGanhState = {
      ...after,
      turn: 1,
      moveCount: 3,
      lastMove: { from: at(2, 1), to: at(3, 1) },
      carried: [at(2, 0)],
      forced: at(2, 1),
    };
    renderBoard(view, { mySeat: 1, isMyTurn: true });
    // Seen from Blue: board point (r, c) shows at col 5 - c, row r + 1.
    expect(shown(4, 3).getAttribute('data-forced')).toBe('true');
    expect(shown(4, 4).getAttribute('data-last')).toBe('true');
    expect(shown(5, 3).getAttribute('data-changed')).toBe('true');
    expect(screen.getByText('games.co-ganh.mustOpen')).toBeTruthy();
    expect(screen.getByText(/games\.co-ganh\.carried n=1/)).toBeTruthy();
  });

  it('the moved stone slides in; carried stones turn over after it lands', () => {
    const s = play([[at(4, 2), at(3, 3)]]); // diagonal step up and to the right
    renderBoard(s, { isMyTurn: false });
    const slide = document.querySelector('[data-sliding="true"]') as SVGGElement;
    expect(slide.style.getPropertyValue('--bg-slide-dx')).toBe('-40px');
    expect(slide.style.getPropertyValue('--bg-slide-dy')).toBe('40px');
    // The stone is drawn once: in the overlay, not also in its point.
    expect(document.querySelectorAll('.cg-p0')).toHaveLength(8);
    cleanup();
    const before = fromDiagram(['....B', '.....', 'B.B..', '.R...', '.....'], 0);
    const after = definition.applyMove(
      before,
      0,
      { from: at(3, 1), to: at(2, 1) },
      { rng: undefined as never },
    );
    renderBoard(after, { isMyTurn: false });
    // Both carried stones are now Red and play the turn-over animation.
    expect(document.querySelectorAll('.cg-p0.cg-flip')).toHaveLength(2);
  });

  it('PieceIcon draws a stone of each colour', () => {
    const { container } = render(
      <>
        <PieceIcon seat={0} />
        <PieceIcon seat={1} />
      </>,
    );
    expect(container.querySelectorAll('.cg-p0')).toHaveLength(1);
    expect(container.querySelectorAll('.cg-p1')).toHaveLength(1);
  });
});
