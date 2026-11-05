import { describe, expect, it } from 'vitest';
import { runMove } from '@bg/engine';
import { carriedAt, NEIGHBOURS, openingMoves, surroundedPieces } from '../src/rules/board';
import { definition } from '../src/rules/definition';
import { MOVE_LIMIT } from '../src/rules/rules';
import type { CoGanhState } from '../src/rules/types';
import { at, fromDiagram, play, show } from './helpers';

const ctx = { rng: undefined as never };
const apply = (s: CoGanhState, from: number, to: number) =>
  definition.applyMove(s, s.turn, { from, to }, ctx);
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);

describe('setup', () => {
  it('8 pieces each in the traditional layout, Red first', () => {
    const s = play([]);
    expect(show(s)).toEqual(['BBBBB', 'B...B', 'R...B', 'R...R', 'RRRRR']);
    expect(s.turn).toBe(0);
    expect(definition.activePlayers(s)).toEqual([0]);
    expect(definition.result(s)).toBeNull();
  });

  it('opening moves follow the lines', () => {
    const moves = definition.legalMoves!(play([]), 0);
    expect(moves).toContainEqual({ from: at(3, 0), to: at(3, 1) });
    expect(moves).toContainEqual({ from: at(4, 2), to: at(3, 2) });
    expect(moves).toContainEqual({ from: at(4, 2), to: at(3, 1) }); // (4,2) is a strong point
    expect(moves).not.toContainEqual({ from: at(4, 1), to: at(3, 2) }); // (4,1) has no diagonal
  });
});

describe('lines', () => {
  it('strong points have 8 directions, weak points 4', () => {
    expect(NEIGHBOURS[at(2, 2)]).toHaveLength(8);
    expect(NEIGHBOURS[at(2, 1)]).toHaveLength(4);
    expect(NEIGHBOURS[at(0, 0)]).toEqual([at(0, 1), at(1, 0), at(1, 1)]);
    expect(NEIGHBOURS[at(0, 1)]).toEqual([at(0, 0), at(0, 2), at(1, 1)]);
  });
});

describe('gánh (carry)', () => {
  it('horizontally', () => {
    const s = fromDiagram(['....B', '.....', 'B.B..', '.R...', '.....'], 0);
    const next = apply(s, at(3, 1), at(2, 1));
    expect(show(next)[2]).toBe('RRR..');
    expect(sorted(next.carried)).toEqual([at(2, 0), at(2, 2)]);
    expect(next.sinceCapture).toBe(0);
  });

  it('diagonally through a strong point, two pairs at once', () => {
    const s = fromDiagram(['B.B..', '..R..', 'B.B..', '.....', '.....'], 0);
    const next = apply(s, at(1, 2), at(1, 1));
    expect(sorted(next.carried)).toEqual([at(0, 0), at(0, 2), at(2, 0), at(2, 2)]);
    expect(next.status).toBe('all_taken');
    expect(definition.result(next)).toEqual({ kind: 'win', winners: [0], reason: 'all_taken' });
    expect(definition.activePlayers(next)).toEqual([]);
  });

  it('no diagonal carry through a weak point', () => {
    const board = fromDiagram(['.B...', '.....', '...B.', '.....', '.....'], 0).board;
    expect(carriedAt(board, at(1, 2), 0)).toEqual([]);
    const s = fromDiagram(['.B...', '.....', '.B.B.', '..R..', '.....'], 0);
    expect(show(apply(s, at(3, 2), at(2, 2)))[2]).toBe('.RRR.');
  });

  it('Blue carries too', () => {
    const s = fromDiagram(['.....', '.....', 'R.R..', '.B...', '....R'], 1);
    const next = apply(s, at(3, 1), at(2, 1));
    expect(show(next)[2]).toBe('BBB..');
    expect(next.turn).toBe(0);
  });
});

describe('vây (surround)', () => {
  it('a piece with a free neighbour is safe; a stuck one is taken', () => {
    const free = apply(fromDiagram(['B....', 'RR...', '.....', '.....', '.....'], 0), at(1, 1), at(0, 1));
    expect(free.surrounded).toEqual([]);
    const stuck = apply(fromDiagram(['B.R..', 'RR...', '.....', '.....', '.....'], 0), at(0, 2), at(0, 1));
    expect(stuck.surrounded).toEqual([at(0, 0)]);
    expect(stuck.board[at(0, 0)]).toBe(0);
  });

  it('a group is taken only when the whole group is stuck', () => {
    const board = fromDiagram(['BB...', 'RRR..', '.....', '.....', '.....'], 0).board;
    expect(surroundedPieces(board, 1)).toEqual([]); // (0,2) is free
    board[at(0, 2)] = 0;
    expect(surroundedPieces(board, 1)).toEqual([at(0, 0), at(0, 1)]);
  });
});

describe('mở (open)', () => {
  it('leaving a point the opponent can carry from forces them in', () => {
    // Red steps (2,1) → (3,1); Blue on (1,1) can now step into (2,1) between the Reds on (2,0) and (2,2).
    const s = fromDiagram(['.....', '.B...', 'RRR..', '.....', 'B...B'], 0);
    const next = apply(s, at(2, 1), at(3, 1));
    expect(next.forced).toBe(at(2, 1));
    expect(definition.legalMoves!(next, 1)).toEqual([{ from: at(1, 1), to: at(2, 1) }]);
    expect(definition.validateMove(next, 1, { from: at(4, 0), to: at(3, 0) })).toEqual({
      ok: false,
      code: 'co-ganh.must_open',
    });
    const after = apply(next, at(1, 1), at(2, 1));
    expect(show(after)[2]).toBe('BBB..');
    expect(after.forced).toBeNull();
  });

  it('no obligation when the empty point carries nothing', () => {
    const s = fromDiagram(['.....', '.B...', 'R.R..', '.R...', 'B...B'], 0);
    const next = apply(s, at(3, 1), at(3, 2));
    expect(next.forced).toBeNull();
    expect(openingMoves(next.board, 1, at(3, 1))).toEqual([]);
    expect(openingMoves(next.board, 1, at(2, 0))).toEqual([]); // occupied
  });
});

describe('end of the game', () => {
  it('120 plies without a capture is a draw', () => {
    const s = apply({ ...play([]), sinceCapture: MOVE_LIMIT - 1 }, at(3, 0), at(3, 1));
    expect(s.status).toBe('move_limit');
    expect(definition.result(s)).toEqual({ kind: 'draw', reason: 'move_limit' });
    expect(definition.activePlayers(s)).toEqual([]);
    expect(definition.legalMoves!(s, 1)).toEqual([]);
  });

  it('a quiet move counts towards the limit', () => {
    const s = { ...fromDiagram(['.....', '.....', 'B.B..', '.R...', '....B'], 0), sinceCapture: 50 };
    expect(apply(s, at(3, 1), at(3, 2)).sinceCapture).toBe(51);
  });
});

describe('validation', () => {
  const s = play([]);
  it.each([
    [{ from: -1, to: 0 }, 'co-ganh.out_of_bounds'],
    [{ from: 0, to: 25 }, 'co-ganh.out_of_bounds'],
    [{ from: at(2, 2), to: at(2, 3) }, 'co-ganh.no_piece'],
    [{ from: at(0, 0), to: at(1, 1) }, 'co-ganh.not_your_piece'],
    [{ from: at(3, 0), to: at(1, 0) }, 'co-ganh.not_adjacent'],
    [{ from: at(4, 1), to: at(3, 2) }, 'co-ganh.not_adjacent'],
    [{ from: at(4, 0), to: at(3, 0) }, 'co-ganh.occupied'],
  ])('%o is rejected with %s', (move, code) => {
    expect(definition.validateMove(s, 0, move)).toEqual({ ok: false, code });
  });

  it('a move out of turn is rejected by the engine', () => {
    const r = runMove(definition, s, 1, { from: at(1, 0), to: at(1, 1) }, {} as never);
    expect(r).toEqual({ ok: false, code: 'engine.not_your_turn' });
  });
});
