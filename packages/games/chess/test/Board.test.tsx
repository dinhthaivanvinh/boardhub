// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BOARD_SETTINGS } from '@bg/ui';
import { setup } from '../src/rules/rules';
import type { ChessState } from '../src/rules/types';
import { Board, PieceIcon } from '../src/ui/Board';
import { fen, play, s } from './helpers';

afterEach(cleanup);

const t = (key: string, values?: Record<string, string | number>) =>
  values
    ? `${key} ${Object.entries(values)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')}`
    : key;

function renderBoard(view: ChessState, opts: { mySeat?: number; isMyTurn?: boolean } = {}) {
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

const square = (name: string) => document.querySelector(`[data-square="${name}"]`) as HTMLElement;

describe('chess board', () => {
  it('64 squares, White at the bottom for White, Black at the bottom for Black', () => {
    renderBoard(setup({}));
    expect(screen.getAllByRole('gridcell')).toHaveLength(64);
    const cells = screen.getAllByRole('gridcell');
    expect(cells[56]!.getAttribute('data-square')).toBe('a1');
    expect(square('e1').getAttribute('data-piece')).toBe('wK');
    cleanup();
    renderBoard(setup({}), { mySeat: 1, isMyTurn: false });
    expect(screen.getAllByRole('gridcell')[56]!.getAttribute('data-square')).toBe('h8');
  });

  it('select a piece, see its moves, then move', () => {
    const { onMove } = renderBoard(setup({}));
    fireEvent.click(square('g1'));
    expect(square('g1').getAttribute('data-selected')).toBe('true');
    const targets = screen.getAllByRole('gridcell').filter((c) => c.getAttribute('data-target') === 'true');
    expect(targets.map((c) => c.getAttribute('data-square')).sort()).toEqual(['f3', 'h3']);
    fireEvent.click(square('f3'));
    expect(onMove).toHaveBeenCalledWith({ from: s('g1'), to: s('f3') });
  });

  it('cannot pick the opponent, a stuck piece, or move out of turn; clicking again deselects', () => {
    const { onMove } = renderBoard(setup({}));
    fireEvent.click(square('e7'));
    expect(square('e7').getAttribute('data-selected')).toBeNull();
    fireEvent.click(square('a1')); // the rook has no move yet
    expect(square('a1').getAttribute('data-selected')).toBeNull();
    fireEvent.click(square('e2'));
    fireEvent.click(square('e2'));
    expect(square('e2').getAttribute('data-selected')).toBeNull();
    cleanup();
    renderBoard(setup({}), { isMyTurn: false });
    fireEvent.click(square('e2'));
    expect(square('e2').getAttribute('data-selected')).toBeNull();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('promotion asks which piece', () => {
    const { onMove } = renderBoard(fen('8/P7/8/8/8/8/8/k6K w - -'));
    fireEvent.click(square('a7'));
    fireEvent.click(square('a8'));
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'games.chess.pieceNames.N' }));
    expect(onMove).toHaveBeenCalledWith({ from: s('a7'), to: s('a8'), promotion: 'N' });
  });

  it('the moved piece slides in (the rook too when castling); check is marked and announced', () => {
    const castled = play(['e1g1'], fen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq -'));
    renderBoard(castled, { isMyTurn: false });
    expect(document.querySelectorAll('[data-sliding="true"]')).toHaveLength(2);
    expect(screen.getByText(/games\.chess\.castleK/)).toBeTruthy();
    cleanup();
    const checked = play(['e2e4', 'f7f6', 'd1h5']);
    renderBoard(checked, { mySeat: 1 });
    expect(square('e8').getAttribute('data-check')).toBe('true');
    expect(screen.getByText(/games\.chess\.check/)).toBeTruthy();
  });

  it('PieceIcon draws each king', () => {
    const { container } = render(
      <>
        <PieceIcon seat={0} />
        <PieceIcon seat={1} />
      </>,
    );
    expect(container.querySelectorAll('[data-piece-shape="wK"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-piece-shape="bK"]')).toHaveLength(1);
  });
});
