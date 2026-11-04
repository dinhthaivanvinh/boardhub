import { describe, expect, it } from 'vitest';
import { createRng, runMove, setupMatch } from '@bg/engine';
import { definition } from '../src/rules/definition';
import { findWinLine } from '../src/rules/win';
import type { CaroState } from '../src/rules/types';
import { at, noWinPattern, play } from './helpers';

const ctx = { rng: createRng('caro', 0) };
const OPEN = { blockedEndsRule: false };

describe('setup', () => {
  it('uses Vietnamese defaults: 15x15, 5 to win, blocked ends rule on, overlines allowed', () => {
    const { config, state } = setupMatch(definition, {}, 2, 's');
    expect(config).toEqual({ size: 15, winLength: 5, blockedEndsRule: true, exactLength: false });
    expect(state.board).toHaveLength(225);
    expect(state.board.every((c) => c === null)).toBe(true);
    expect(state).toMatchObject({ turn: 0, moveCount: 0, lastMove: null, winner: null, winLine: null });
    expect(definition.activePlayers(state)).toEqual([0]);
  });

  it('supports a 19x19 board', () => {
    expect(setupMatch(definition, { size: 19 }, 2, 's').state.board).toHaveLength(361);
  });

  it('rejects unsupported config', () => {
    expect(() => setupMatch(definition, { size: 17 }, 2, 's')).toThrow();
    expect(() => setupMatch(definition, { winLength: 6 }, 2, 's')).toThrow();
    expect(() => setupMatch(definition, {}, 3, 's')).toThrow();
  });
});

describe('moves', () => {
  const start = setupMatch(definition, {}, 2, 's').state;

  it('places a piece and passes the turn', () => {
    const s = play({}, [at(7, 7)], []);
    expect(s.board[at(7, 7)]).toBe(0);
    expect(s).toMatchObject({ turn: 1, moveCount: 1, lastMove: at(7, 7) });
    expect(definition.activePlayers(s)).toEqual([1]);
  });

  it('rejects cells outside the board', () => {
    expect(definition.validateMove(start, 0, { cell: -1 })).toEqual({
      ok: false,
      code: 'caro.out_of_bounds',
    });
    expect(definition.validateMove(start, 0, { cell: 225 })).toEqual({
      ok: false,
      code: 'caro.out_of_bounds',
    });
  });

  it('rejects an occupied cell', () => {
    const s = play({}, [at(7, 7)], []);
    expect(runMove(definition, s, 1, { cell: at(7, 7) }, ctx)).toEqual({
      ok: false,
      code: 'caro.cell_occupied',
    });
  });

  it('rejects moves out of turn and badly shaped moves', () => {
    expect(runMove(definition, start, 1, { cell: 0 }, ctx)).toMatchObject({ code: 'engine.not_your_turn' });
    expect(runMove(definition, start, 0, { cell: 1.5 }, ctx)).toMatchObject({
      code: 'engine.invalid_move_shape',
    });
    expect(runMove(definition, start, 0, { cell: 1, extra: true }, ctx)).toMatchObject({
      code: 'engine.invalid_move_shape',
    });
  });

  it('lists every empty cell as legal', () => {
    const s = play({}, [at(0, 0)], [at(0, 1)]);
    const legal = definition.legalMoves!(s, 0);
    expect(legal).toHaveLength(223);
    expect(legal).not.toContainEqual({ cell: at(0, 0) });
    expect(legal).not.toContainEqual({ cell: at(0, 1) });
  });
});

describe('playerView', () => {
  it('shows the whole state to players and spectators (perfect information)', () => {
    const s = play({}, [at(7, 7)], [at(7, 8)]);
    for (const viewer of [0, 1, 'spectator'] as const) expect(definition.playerView(s, viewer)).toEqual(s);
  });
});

describe('winning lines', () => {
  const filler = [at(14, 0), at(14, 2), at(14, 4), at(14, 6)];

  it.each([
    ['horizontal', [at(7, 3), at(7, 4), at(7, 5), at(7, 6), at(7, 7)]],
    ['vertical', [at(3, 7), at(4, 7), at(5, 7), at(6, 7), at(7, 7)]],
    ['diagonal', [at(3, 3), at(4, 4), at(5, 5), at(6, 6), at(7, 7)]],
    ['anti-diagonal', [at(3, 11), at(4, 10), at(5, 9), at(6, 8), at(7, 7)]],
  ])('%s five in a row wins', (_name, line) => {
    const s = play({}, line, filler);
    expect(definition.result(s)).toEqual({ kind: 'win', winners: [0], reason: 'five_in_row' });
    expect([...s.winLine!].sort((a, b) => a - b)).toEqual([...line].sort((a, b) => a - b));
    expect(definition.activePlayers(s)).toEqual([]);
  });

  it('a win can be completed in the middle of the line', () => {
    const s = play({}, [at(7, 3), at(7, 4), at(7, 6), at(7, 7), at(7, 5)], filler);
    expect(s.winner).toBe(0);
    expect(s.winLine).toEqual([at(7, 3), at(7, 4), at(7, 5), at(7, 6), at(7, 7)]);
  });

  it('four in a row does not win', () => {
    const s = play({}, [at(7, 3), at(7, 4), at(7, 5), at(7, 6)], filler);
    expect(definition.result(s)).toBeNull();
  });

  it('O can win too', () => {
    const s = play(
      {},
      [at(0, 0), at(0, 2), at(0, 4), at(0, 6), at(0, 8)],
      [at(7, 3), at(7, 4), at(7, 5), at(7, 6), at(7, 7)],
    );
    expect(definition.result(s)).toEqual({ kind: 'win', winners: [1], reason: 'five_in_row' });
  });

  it('wins at the bottom-right corner with one open end', () => {
    const s = play({}, [at(14, 10), at(14, 11), at(14, 12), at(14, 13), at(14, 14)], [0, 2, 4, 6]);
    expect(s.winner).toBe(0);
  });
});

describe('blockedEndsRule', () => {
  const x = [at(7, 3), at(7, 4), at(7, 5), at(7, 6), at(7, 7)];
  const blockers = [at(7, 2), at(7, 8), at(0, 0), at(0, 2)];

  it('a line blocked by the opponent on both ends does not win', () => {
    const s = play({}, x, blockers);
    expect(definition.result(s)).toBeNull();
    expect(definition.activePlayers(s)).toEqual([1]);
  });

  it('a line blocked on one end still wins', () => {
    const s = play({}, x, [at(7, 2), at(0, 0), at(0, 2), at(0, 4)]);
    expect(s.winner).toBe(0);
  });

  it('the board edge counts as a block', () => {
    const edgeLine = [at(0, 0), at(0, 1), at(0, 2), at(0, 3), at(0, 4)];
    expect(play({}, edgeLine, [at(0, 5), at(9, 0), at(9, 2), at(9, 4)]).winner).toBeNull();
    expect(play({}, edgeLine, [at(9, 6), at(9, 0), at(9, 2), at(9, 4)]).winner).toBe(0);
  });

  it('when off, a line blocked on both ends wins', () => {
    expect(play(OPEN, x, blockers).winner).toBe(0);
  });
});

describe('exactLength (overline)', () => {
  const six = [at(7, 2), at(7, 3), at(7, 4), at(7, 6), at(7, 7), at(7, 5)];
  const filler = [at(0, 0), at(0, 2), at(0, 4), at(0, 6), at(0, 8)];

  it('six in a row does not win when exactLength is on', () => {
    expect(definition.result(play({ exactLength: true }, six, filler))).toBeNull();
  });

  it('exactly five still wins when exactLength is on', () => {
    expect(
      play({ exactLength: true }, [at(7, 3), at(7, 4), at(7, 5), at(7, 6), at(7, 7)], filler.slice(0, 4))
        .winner,
    ).toBe(0);
  });

  it('six in a row wins when exactLength is off', () => {
    const s = play({}, six, filler);
    expect(s.winner).toBe(0);
    expect(s.winLine).toHaveLength(6);
  });
});

describe('full board', () => {
  const size = 15;
  const config = definition.configSchema.parse({});
  const lastCell = at(14, 14);

  function almostFull(board: (0 | 1 | null)[], lastPiece: 0 | 1): CaroState {
    return {
      config,
      board,
      turn: lastPiece,
      moveCount: size * size - 1,
      lastMove: null,
      winner: null,
      winLine: null,
    };
  }

  it('the test pattern itself has no winning line', () => {
    const pattern = noWinPattern(size);
    const loose = { ...config, blockedEndsRule: false };
    pattern.forEach((piece, cell) => expect(findWinLine(pattern, loose, cell, piece)).toBeNull());
  });

  it('is a draw when the last cell is filled with no winner', () => {
    const pattern = noWinPattern(size);
    const piece = pattern[lastCell]!;
    const board: (0 | 1 | null)[] = pattern.slice();
    board[lastCell] = null;
    const res = runMove(definition, almostFull(board, piece), piece, { cell: lastCell }, ctx);
    expect(res.ok && res.result).toEqual({ kind: 'draw', reason: 'board_full' });
  });

  it('is a win, not a draw, when the last move fills the board and makes a line', () => {
    const board: (0 | 1 | null)[] = noWinPattern(size);
    for (const col of [0, 1, 2, 3]) board[at(0, col)] = 0;
    board[at(0, 4)] = null;
    const state = { ...almostFull(board, 0), config: { ...config, blockedEndsRule: false } };
    const res = runMove(definition, state, 0, { cell: at(0, 4) }, ctx);
    expect(res.ok && res.result).toEqual({ kind: 'win', winners: [0], reason: 'five_in_row' });
  });
});
