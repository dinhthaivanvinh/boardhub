import { describe, expect, it } from 'vitest';
import { fromFen, inCheck, legalMoves, squareName } from '../src/rules/board';
import {
  DRAW_ROUNDS,
  drawKind,
  FORK_ROUNDS,
  forkMoves,
  forkTargets,
  PIN_ROUNDS,
  pinnedSquares,
  pinners,
} from '../src/learn/tactics';

describe('tactics lesson data', () => {
  it('fork rounds: White to move, Black not in check, and at least one safe fork exists', () => {
    for (const { fen } of FORK_ROUNDS) {
      const pos = fromFen(fen);
      expect(pos.turn, fen).toBe('w');
      expect(inCheck(pos.board, 'b'), fen).toBe(false);
      const forks = forkMoves(pos);
      expect(forks.length, fen).toBeGreaterThan(0);
      for (const m of forks) expect(forkTargets(pos, m).length, fen).toBeGreaterThanOrEqual(2);
      // There are plain moves to refuse as well.
      expect(legalMoves(pos).length, fen).toBeGreaterThan(forks.length);
    }
  });

  it('fork rounds: the move the lesson is built around is among the accepted ones', () => {
    const expected: Record<string, string[]> = {
      'k2q3r/8/8/4N3/8/8/8/K7 w - -': ['e5f7'],
      'r3k3/8/8/1N6/8/8/8/7K w - -': ['b5c7'],
      '7k/8/3n1n2/8/4P3/8/8/K7 w - -': ['e4e5'],
      '4k3/8/B7/8/8/3r4/8/K7 w - -': ['a6b5'],
    };
    for (const { fen } of FORK_ROUNDS) {
      const names = forkMoves(fromFen(fen)).map((m) => `${squareName(m.from)}${squareName(m.to)}`);
      for (const want of expected[fen]!) expect(names, fen).toContain(want);
    }
  });

  it('pin rounds: exactly one pinned piece, a pinner, and another white piece that is free', () => {
    for (const { fen } of PIN_ROUNDS) {
      const pos = fromFen(fen);
      expect(pos.turn, fen).toBe('w');
      expect(inCheck(pos.board, 'w'), fen).toBe(false);
      const pinned = pinnedSquares(pos);
      expect(pinned, fen).toHaveLength(1);
      expect(pinners(pos, pinned[0]!).length, fen).toBeGreaterThan(0);
      const others = pos.board.flatMap((p, s) =>
        p && p[0] === 'w' && p[1] !== 'K' && !pinned.includes(s) ? [s] : [],
      );
      expect(others.length, fen).toBeGreaterThan(0);
    }
  });

  it('draw rounds: mate, stalemate and still-going all appear, as the engine says', () => {
    const kinds = DRAW_ROUNDS.map(({ fen }) => {
      const pos = fromFen(fen);
      expect(pos.turn, fen).toBe('b');
      return drawKind(pos);
    });
    expect(kinds).toEqual(['mate', 'stalemate', 'ongoing', 'stalemate', 'ongoing']);
  });
});
