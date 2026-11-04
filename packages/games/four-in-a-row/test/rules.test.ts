import { describe, expect, it } from 'vitest';
import { createRng, runMove, setupMatch } from '@bg/engine';
import { findWinLine } from '../src/rules/board';
import { definition } from '../src/rules/definition';
import type { FourSeat, FourState } from '../src/rules/types';
import { at, drops, fromDiagram, mirror, noWinPattern } from './helpers';

const ctx = { rng: createRng('fiar', 0) };

function dropAndResult(state: FourState, col: number) {
  const res = runMove(definition, state, state.turn, { col }, ctx);
  if (!res.ok) throw new Error(res.code);
  return res;
}

describe('setup', () => {
  it('defaults to an empty 7x6 board with Yellow to move', () => {
    const { config, state } = setupMatch(definition, {}, 2, 's');
    expect(config).toEqual({ columns: 7, rows: 6 });
    expect(state.board).toHaveLength(42);
    expect(state.board.every((c) => c === null)).toBe(true);
    expect(state).toMatchObject({ turn: 0, moveCount: 0, lastMove: null, winner: null, winLine: null });
  });

  it.each([
    [{ columns: 8, rows: 7 }, 56],
    [{ columns: 9, rows: 7 }, 63],
    [{ columns: 9, rows: 6 }, 54],
  ])('supports %o', (config, cells) => {
    expect(setupMatch(definition, config, 2, 's').state.board).toHaveLength(cells);
  });

  it('rejects unsupported config and player counts', () => {
    expect(() => setupMatch(definition, { columns: 10 }, 2, 's')).toThrow();
    expect(() => setupMatch(definition, { rows: 5 }, 2, 's')).toThrow();
    expect(() => setupMatch(definition, {}, 1, 's')).toThrow();
  });
});

describe('dropping pieces', () => {
  it('a piece falls to the lowest empty cell', () => {
    const s = drops([3]);
    expect(s.board[at(5, 3)]).toBe(0);
    expect(s).toMatchObject({ turn: 1, moveCount: 1, lastMove: at(5, 3) });
    const s2 = drops([3, 3]);
    expect(s2.board[at(4, 3)]).toBe(1);
    expect(s2.lastMove).toBe(at(4, 3));
  });

  it('a full column is rejected and not listed as legal', () => {
    const s = drops([0, 0, 0, 0, 0, 0]);
    expect(definition.validateMove(s, 0, { col: 0 })).toEqual({
      ok: false,
      code: 'four-in-a-row.column_full',
    });
    expect(definition.legalMoves!(s, 0).map((m) => m.col)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('columns outside the board are rejected', () => {
    const s = drops([]);
    expect(definition.validateMove(s, 0, { col: -1 })).toEqual({
      ok: false,
      code: 'four-in-a-row.out_of_bounds',
    });
    expect(definition.validateMove(s, 0, { col: 7 })).toEqual({
      ok: false,
      code: 'four-in-a-row.out_of_bounds',
    });
  });

  it('rejects moves out of turn and badly shaped moves', () => {
    const s = drops([]);
    expect(runMove(definition, s, 1, { col: 0 }, ctx)).toMatchObject({ code: 'engine.not_your_turn' });
    expect(runMove(definition, s, 0, { cell: 3 }, ctx)).toMatchObject({ code: 'engine.invalid_move_shape' });
  });

  it('playerView shows everything to everyone', () => {
    const s = drops([3, 4]);
    for (const viewer of [0, 1, 'spectator'] as const) expect(definition.playerView(s, viewer)).toEqual(s);
  });
});

describe('winning', () => {
  it('horizontal four on the bottom row (corner)', () => {
    const s = drops([0, 0, 1, 1, 2, 2, 3]);
    expect(definition.result(s)).toEqual({ kind: 'win', winners: [0], reason: 'four_in_row' });
    expect(s.winLine).toEqual([at(5, 0), at(5, 1), at(5, 2), at(5, 3)]);
    expect(definition.activePlayers(s)).toEqual([]);
  });

  it('vertical four at the right edge', () => {
    const s = drops([6, 5, 6, 5, 6, 5, 6]);
    expect(s.winner).toBe(0);
    expect(s.winLine).toEqual([at(2, 6), at(3, 6), at(4, 6), at(5, 6)]);
  });

  it('Red can win too', () => {
    expect(drops([0, 1, 0, 1, 0, 1, 6, 1]).winner).toBe(1);
  });

  const rising = ['.......', '.......', '.......', '..YR...', '.YRR...', 'YRRY...'];

  it('rising diagonal', () => {
    const res = dropAndResult(fromDiagram(rising, 0), 3);
    expect(res.result).toEqual({ kind: 'win', winners: [0], reason: 'four_in_row' });
    expect(res.state.winLine).toEqual([at(2, 3), at(3, 2), at(4, 1), at(5, 0)]);
  });

  it('falling diagonal (mirror image)', () => {
    const res = dropAndResult(fromDiagram(mirror(rising), 0), 3);
    expect(res.result).toMatchObject({ kind: 'win', winners: [0] });
    expect(res.state.winLine).toHaveLength(4);
  });

  it('five in a row also wins', () => {
    const s = fromDiagram(['.......', '.......', '.......', '.......', 'RR.RR..', 'YY.YY..'], 0);
    const res = dropAndResult(s, 2);
    expect(res.state.winLine).toHaveLength(5);
    expect(res.result).toMatchObject({ kind: 'win', winners: [0] });
  });

  it('three in a row does not win', () => {
    expect(definition.result(drops([0, 0, 1, 1, 2]))).toBeNull();
  });
});

describe('full board', () => {
  const config = definition.configSchema.parse({});

  function almostFull(board: (FourSeat | null)[], turn: FourSeat): FourState {
    return { config, board, turn, moveCount: 41, lastMove: null, winner: null, winLine: null };
  }

  it('the test pattern itself has no line of four', () => {
    const pattern = noWinPattern(7, 6);
    pattern.forEach((piece, cell) => expect(findWinLine(pattern, config, cell, piece)).toBeNull());
  });

  it('filling the last cell with no four is a draw', () => {
    const board: (FourSeat | null)[] = noWinPattern(7, 6);
    const piece = board[0]!;
    board[0] = null;
    expect(dropAndResult(almostFull(board, piece), 0).result).toEqual({ kind: 'draw', reason: 'board_full' });
  });

  it('filling the last cell with a four is a win, not a draw', () => {
    const board: (FourSeat | null)[] = noWinPattern(7, 6);
    board[0] = null;
    for (const col of [1, 2, 3]) board[col] = 0;
    expect(dropAndResult(almostFull(board, 0), 0).result).toMatchObject({ kind: 'win', winners: [0] });
  });
});
