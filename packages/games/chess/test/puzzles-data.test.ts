import { describe, expect, it } from 'vitest';
import { fromFen, inCheck, legalMoves, makeMove } from '../src/rules/board';
import { matingMoves } from '../src/learn/checkmate';
import { dailyPuzzle, MATE_PUZZLES, nextPuzzle, puzzlesOfTier } from '../src/learn/puzzles';

const day = (month: number, d: number) =>
  `2026-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

describe('mate-in-one puzzles', () => {
  it('has enough puzzles in every tier, with unique ids and positions', () => {
    for (const tier of [1, 2, 3] as const) expect(puzzlesOfTier(tier).length).toBeGreaterThanOrEqual(40);
    expect(new Set(MATE_PUZZLES.map((p) => p.id)).size).toBe(MATE_PUZZLES.length);
    expect(new Set(MATE_PUZZLES.map((p) => p.fen)).size).toBe(MATE_PUZZLES.length);
  });

  it('every puzzle: White to move, nobody in check, no promotion, and a mate exists', () => {
    for (const { id, fen } of MATE_PUZZLES) {
      const pos = fromFen(fen);
      expect(pos.turn, id).toBe('w');
      expect(inCheck(pos.board, 'b'), id).toBe(false);
      expect(inCheck(pos.board, 'w'), id).toBe(false);
      expect(
        legalMoves(pos).some((m) => m.promotion),
        id,
      ).toBe(false);
      const mates = matingMoves(pos);
      expect(mates.length, id).toBeGreaterThanOrEqual(1);
      for (const m of mates) expect(legalMoves(makeMove(pos, m)).length, id).toBe(0);
    }
  });
});

describe('puzzle of the day', () => {
  it('is the same all day and for everybody, and changes every day', () => {
    expect(dailyPuzzle(day(3, 5))).toBe(dailyPuzzle(day(3, 5)));
    const ids = new Set(Array.from({ length: 14 }, (_, i) => dailyPuzzle(day(3, i + 1)).id));
    expect(ids.size).toBe(14);
  });

  it('is a mix of tiers, mostly easy ones', () => {
    const tiers = Array.from({ length: 28 }, (_, i) => dailyPuzzle(day(5, i + 1)).tier);
    expect(tiers.filter((t) => t === 1).length).toBeGreaterThan(tiers.filter((t) => t === 3).length);
    expect(new Set(tiers)).toEqual(new Set([1, 2, 3]));
  });
});

describe('the next puzzle of a tier', () => {
  it('skips the solved ones, goes on after the current one, and is null when all are solved', () => {
    const list = puzzlesOfTier(1);
    expect(nextPuzzle(1, new Set())!.id).toBe(list[0]!.id);
    expect(nextPuzzle(1, new Set([list[0]!.id]))!.id).toBe(list[1]!.id);
    expect(nextPuzzle(1, new Set(), list[0]!.id)!.id).toBe(list[1]!.id);
    expect(nextPuzzle(1, new Set(list.map((p) => p.id)))).toBeNull();
  });
});
