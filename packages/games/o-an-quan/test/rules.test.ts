import { describe, expect, it } from 'vitest';
import { playMoves } from '@bg/engine/testing';
import { definition } from '../src/rules/definition';
import { MOVE_LIMIT, scores } from '../src/rules/rules';
import type { OAnQuanMove, OAnQuanState } from '../src/rules/types';
import { position } from './helpers';

const ctx = { rng: undefined as never };
const apply = (s: OAnQuanState, cell: number, dir: 1 | -1) =>
  definition.applyMove(s, s.turn, { cell, dir }, ctx);
const total = (s: OAnQuanState) => s.cells.reduce((a, b) => a + b, 0) + s.stash[0]!.dan + s.stash[1]!.dan;

describe('setup', () => {
  it('5 dân per square, a quan on each end, side 1 first', () => {
    const s = playMoves(definition, {}, []);
    expect(s.cells).toEqual([0, 5, 5, 5, 5, 5, 0, 5, 5, 5, 5, 5]);
    expect(s.quan).toEqual([true, true]);
    expect(s.turn).toBe(0);
    expect(definition.legalMoves!(s, 0)).toHaveLength(10);
    expect(definition.legalMoves!(s, 1)[0]).toEqual({ cell: 7, dir: -1 });
    expect(scores(s)).toEqual([25, 25]);
  });
});

describe('sowing', () => {
  it('keeps sowing from a full square, then captures past an empty one', () => {
    // 1 → 2..6, pick up 7 → 8..11, 0; next is the emptied 1, so square 2 (6 dân) is taken.
    const s = apply(playMoves(definition, {}, []), 1, 1);
    expect(s.cells).toEqual([1, 0, 0, 6, 6, 6, 1, 0, 6, 6, 6, 6]);
    expect(s.stash[0]).toEqual({ dan: 6, quan: 0 });
    expect(s.taken).toEqual([2]);
    expect(s.sown).toEqual([2, 3, 4, 5, 6, 8, 9, 10, 11, 0]);
    expect(s.turn).toBe(1);
    expect(total(s)).toBe(50);
  });

  it('captures a quan square: the quan and its dân', () => {
    // 5 → 6..10, pick up 11 → 0..4; next is the emptied 5, so the right quan square (quan + 1 dân) is taken.
    const s = apply(playMoves(definition, {}, []), 5, 1);
    expect(s.cells).toEqual([1, 6, 6, 6, 6, 0, 0, 6, 6, 6, 6, 0]);
    expect(s.stash[0]).toEqual({ dan: 1, quan: 1 });
    expect(s.quan).toEqual([true, false]);
    expect(s.taken).toEqual([6]);
  });

  it('sowing to the left goes through the left quan square', () => {
    const s = apply(position([0, 0, 1, 0, 0, 0, 0, 2, 0, 0, 0, 1]), 2, -1);
    // 2 → 1; next 0 is a quan square with its quan: stop.
    expect(s.cells).toEqual([0, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1]);
    expect(s.taken).toEqual([]);
  });

  it('a quan square stops the turn', () => {
    const s = apply(position([0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1]), 4, 1);
    expect(s.cells[5]).toBe(1);
    expect(s.taken).toEqual([]);
    expect(s.stash[0]).toEqual({ dan: 0, quan: 0 });
  });

  it('two empty squares in a row: nothing is taken (an emptied quan square counts as empty)', () => {
    const s = apply(position([0, 0, 0, 1, 0, 0, 0, 3, 0, 0, 0, 1], { quan: [true, false] }), 3, 1);
    expect(s.taken).toEqual([]);
    expect(s.cells).toEqual([0, 0, 0, 0, 1, 0, 0, 3, 0, 0, 0, 1]);
  });

  it('captures again and again while "empty, full" repeats', () => {
    // 1 → 2; 3 empty → take 4; 5 empty → take the quan square 6; 7 empty → take 8; 9 is full → stop.
    const s = apply(position([0, 1, 0, 0, 3, 0, 2, 0, 4, 1, 0, 0]), 1, 1);
    expect(s.taken).toEqual([4, 6, 8]);
    expect(s.stash[0]).toEqual({ dan: 9, quan: 1 });
    expect(s.cells).toEqual([0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0]);
    expect(s.ended).toBeNull();
  });

  it('a big square goes all the way round, past its own square', () => {
    const s = apply(position([0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 1, 1);
    // 12 stones land on 2..11, 0, 1; then pick up 2 (1) → 3; pick up 4 (1) → 5; next is the quan square: stop.
    expect(s.cells).toEqual([1, 1, 0, 2, 0, 2, 1, 1, 1, 1, 1, 1]);
    expect(s.sown).toHaveLength(14);
  });
});

describe('running out of dân', () => {
  const emptyTop = [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0];

  it('the next side puts back 5 of its own dân', () => {
    const s = apply(
      position(emptyTop, {
        stash: [
          { dan: 0, quan: 0 },
          { dan: 7, quan: 0 },
        ],
      }),
      3,
      1,
    );
    // 3 → 4; 5 empty → take the right quan square. Side 2 has nothing left on its row.
    expect(s.quan).toEqual([true, false]);
    expect(s.refill).toEqual({ seat: 1, borrowed: 0 });
    expect(s.cells.slice(7)).toEqual([1, 1, 1, 1, 1]);
    expect(s.stash[1]).toEqual({ dan: 2, quan: 0 });
    expect(definition.legalMoves!(s, 1)).toHaveLength(10);
  });

  it('borrows what is missing from the opponent, and pays it back in the score', () => {
    const s = apply(
      position(emptyTop, {
        stash: [
          { dan: 10, quan: 0 },
          { dan: 2, quan: 0 },
        ],
      }),
      3,
      1,
    );
    expect(s.refill).toEqual({ seat: 1, borrowed: 3 });
    expect(s.stash[0]!.dan).toBe(7);
    expect(s.stash[1]!.dan).toBe(0);
    expect(s.debt).toEqual([0, 3]);
    // Side 1: 7 + 10 (quan) + 1 on row + 3 owed = 21. Side 2: 0 + 5 on row - 3 = 2.
    expect(scores(s)).toEqual([21, 2]);
  });

  it('nothing to put back or borrow: the game is scored', () => {
    const s = apply(
      position(emptyTop, {
        stash: [
          { dan: 1, quan: 0 },
          { dan: 2, quan: 0 },
        ],
      }),
      3,
      1,
    );
    expect(s.ended).toBe('no_stones');
    expect(definition.result(s)).toEqual({ kind: 'win', winners: [0], reason: 'more_points' });
    expect(definition.legalMoves!(s, 1)).toEqual([]);
    expect(definition.activePlayers(s)).toEqual([]);
  });
});

describe('end of the game', () => {
  it('ends when both quan are taken; dân left on a row belong to its side', () => {
    const s = apply(
      position([0, 0, 0, 1, 0, 0, 3, 0, 0, 0, 0, 2], {
        quan: [false, true],
        stash: [
          { dan: 0, quan: 1 },
          { dan: 4, quan: 0 },
        ],
      }),
      3,
      1,
    );
    expect(s.ended).toBe('quan_taken');
    // Side 1: 3 + 2 × 10 + 1 on row = 24. Side 2: 4 + 2 on row = 6.
    expect(scores(s)).toEqual([24, 6]);
    expect(definition.result(s)).toEqual({ kind: 'win', winners: [0], reason: 'more_points' });
  });

  it('equal points is a draw', () => {
    const s = { ...position([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), ended: 'quan_taken' as const };
    expect(definition.result(s)).toEqual({ kind: 'draw', reason: 'equal_points' });
  });

  it('the move limit scores the game', () => {
    const s = apply(position([0, 5, 5, 5, 5, 5, 0, 5, 5, 5, 5, 5], { moveCount: MOVE_LIMIT - 1 }), 4, 1);
    expect(s.ended).toBe('move_limit');
    expect(definition.result(s)).not.toBeNull();
  });

  it('a full game always keeps 50 dân and ends', () => {
    let s = playMoves(definition, {}, []);
    let guard = 0;
    while (!definition.result(s) && guard++ < 400) {
      const moves = definition.legalMoves!(s, s.turn);
      s = definition.applyMove(s, s.turn, moves[guard % moves.length] as OAnQuanMove, ctx);
      expect(total(s) + 0).toBe(50);
    }
    expect(definition.result(s)).not.toBeNull();
  });
});

describe('validation', () => {
  const s = position([0, 5, 0, 5, 5, 5, 0, 5, 5, 5, 5, 5]);
  it.each([
    [{ cell: 0, dir: 1 }, 'o-an-quan.not_your_cell'],
    [{ cell: 6, dir: 1 }, 'o-an-quan.not_your_cell'],
    [{ cell: 7, dir: 1 }, 'o-an-quan.not_your_cell'],
    [{ cell: 12, dir: 1 }, 'o-an-quan.not_your_cell'],
    [{ cell: 2, dir: -1 }, 'o-an-quan.empty_cell'],
  ] as const)('%o is rejected with %s', (move, code) => {
    expect(definition.validateMove(s, 0, move)).toEqual({ ok: false, code });
  });

  it('accepts a full square of your own', () => {
    expect(definition.validateMove(s, 0, { cell: 1, dir: -1 })).toEqual({ ok: true });
    expect(definition.validateMove(s, 1, { cell: 9, dir: 1 })).toEqual({ ok: true });
  });
});
