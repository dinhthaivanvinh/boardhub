import { describe, expect, it } from 'vitest';
import {
  BADGES,
  earnedBadges,
  JOURNEY_LESSONS,
  nextLessonId,
  learnerRank,
  totalStars,
} from '../src/learn/journey';
import { LESSON_IDS } from '../src/learn/data';
import {
  EMPTY_PUZZLE_PROGRESS,
  markPuzzleSolved,
  PUZZLE_PROGRESS_KEY,
  readPuzzleProgress,
  streak,
} from '../src/learn/puzzle-progress';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('the journey', () => {
  it('lists every lesson exactly once, in the order to take them', () => {
    expect([...JOURNEY_LESSONS].sort()).toEqual([...LESSON_IDS].sort());
    expect(JOURNEY_LESSONS[0]).toBe('coordinates');
  });

  it('teaches the special moves before the openings, which use them', () => {
    const at = (id: string) => JOURNEY_LESSONS.indexOf(id);
    expect(at('castling')).toBeGreaterThan(at('draws'));
    expect(at('tactics')).toBeGreaterThan(at('promotion'));
    expect(at('italian')).toBeGreaterThan(at('tactics'));
  });

  it('points at the first lesson not done, and at nothing when all are', () => {
    expect(nextLessonId(new Set())).toBe('coordinates');
    expect(nextLessonId(new Set(['coordinates']))).toBe('setup');
    expect(nextLessonId(new Set(['coordinates', 'setup']))).toBe('pawn');
    expect(nextLessonId(new Set(['coordinates', 'setup', 'rook']))).toBe('pawn');
    expect(nextLessonId(new Set(JOURNEY_LESSONS))).toBeNull();
  });
});

describe('stars and ranks', () => {
  it('3 stars a lesson and 1 a puzzle; unknown puzzle ids count for nothing', () => {
    const p = { ...EMPTY_PUZZLE_PROGRESS, solved: ['t1-01', 't1-02', 'gone'] };
    expect(totalStars(new Set(['coordinates', 'pawn']), p)).toBe(2 * 3 + 2);
    expect(totalStars(new Set(), EMPTY_PUZZLE_PROGRESS)).toBe(0);
  });

  it('gives a rank for the stars and tells how many are missing for the next', () => {
    expect(learnerRank(0).rank.id).toBe('chick');
    expect(learnerRank(9).toNext).toBe(1);
    expect(learnerRank(10).rank.id).toBe('pawn');
    expect(learnerRank(10_000).next).toBeNull();
    expect(learnerRank(10_000).rank.id).toBe('king');
  });
});

describe('badges', () => {
  const today = '2026-03-10';

  it('start empty and grow with what is done', () => {
    expect(earnedBadges(new Set(), EMPTY_PUZZLE_PROGRESS, today)).toEqual([]);
    expect(earnedBadges(new Set(['coordinates']), EMPTY_PUZZLE_PROGRESS, today)).toEqual([
      'first',
      'coordinates',
    ]);
    const six = new Set(['pawn', 'rook', 'bishop', 'knight', 'queen', 'king']);
    expect(earnedBadges(six, EMPTY_PUZZLE_PROGRESS, today)).toContain('pieces');
    expect(earnedBadges(new Set(JOURNEY_LESSONS), EMPTY_PUZZLE_PROGRESS, today)).toContain('master');
  });

  it('puzzle and streak badges', () => {
    const p = {
      solved: ['t1-01', 't1-02', 't1-03', 't1-04', 't1-05'],
      days: ['2026-03-08', '2026-03-09', '2026-03-10'],
      daily: [],
    };
    const got = earnedBadges(new Set(), p, today);
    expect(got).toContain('puzzles5');
    expect(got).toContain('streak3');
    expect(got).not.toContain('streak7');
  });

  it('every badge has a distinct id', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
  });
});

describe('puzzle progress storage', () => {
  it('remembers solved puzzles and days, once each', () => {
    const store = memory();
    markPuzzleSolved(store, 't1-01', '2026-03-10', true);
    const after = markPuzzleSolved(store, 't1-01', '2026-03-10');
    expect(after).toEqual({ solved: ['t1-01'], days: ['2026-03-10'], daily: ['2026-03-10'] });
    expect(readPuzzleProgress(store)).toEqual(after);
  });

  it('survives broken or missing storage', () => {
    expect(readPuzzleProgress(null)).toEqual(EMPTY_PUZZLE_PROGRESS);
    const broken = memory();
    broken.setItem(PUZZLE_PROGRESS_KEY, '{nope');
    expect(readPuzzleProgress(broken)).toEqual(EMPTY_PUZZLE_PROGRESS);
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(() => markPuzzleSolved(full, 'x', '2026-03-10')).not.toThrow();
  });
});

describe('streak', () => {
  it('counts days in a row up to today', () => {
    expect(streak(['2026-03-08', '2026-03-09', '2026-03-10'], '2026-03-10')).toBe(3);
  });

  it("keeps yesterday's streak until the day is over, then breaks", () => {
    expect(streak(['2026-03-08', '2026-03-09'], '2026-03-10')).toBe(2);
    expect(streak(['2026-03-08', '2026-03-09'], '2026-03-11')).toBe(0);
  });

  it('a gap breaks it, and month and year ends are fine', () => {
    expect(streak(['2026-03-05', '2026-03-09', '2026-03-10'], '2026-03-10')).toBe(2);
    expect(streak(['2025-12-30', '2025-12-31', '2026-01-01'], '2026-01-01')).toBe(3);
    expect(streak([], '2026-01-01')).toBe(0);
  });
});
