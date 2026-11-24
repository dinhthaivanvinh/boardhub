import { describe, expect, it } from 'vitest';
import {
  EMPTY_LEARN_PROGRESS,
  LearnProgressSchema,
  mergeLearnProgress,
  sameLearnProgress,
} from '../src/rest';

const p = (over: Partial<typeof EMPTY_LEARN_PROGRESS>) => ({ ...EMPTY_LEARN_PROGRESS, ...over });

describe('learning progress', () => {
  it('accepts plain ids and dates, and nothing else', () => {
    expect(LearnProgressSchema.safeParse(p({ lessons: ['pawn'], days: ['2026-03-01'] })).success).toBe(true);
    for (const bad of [
      p({ lessons: ['Pawn With Spaces'] }),
      p({ puzzles: ['<script>'] }),
      p({ days: ['yesterday'] }),
      { ...EMPTY_LEARN_PROGRESS, name: 'Bé An' },
      p({ puzzles: Array.from({ length: 1001 }, (_, i) => `t1-${i}`) }),
    ]) {
      expect(LearnProgressSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('merging keeps everything either side earned, once', () => {
    const a = p({ lessons: ['coordinates', 'pawn'], puzzles: ['t1-01'], days: ['2026-03-02'] });
    const b = p({
      lessons: ['pawn', 'rook'],
      puzzles: ['t1-02'],
      days: ['2026-03-01'],
      daily: ['2026-03-01'],
    });
    const m = mergeLearnProgress(a, b);
    expect(m.lessons.sort()).toEqual(['coordinates', 'pawn', 'rook']);
    expect(m.puzzles.sort()).toEqual(['t1-01', 't1-02']);
    expect(m.days).toEqual(['2026-03-01', '2026-03-02']);
    expect(m.daily).toEqual(['2026-03-01']);
  });

  it('merging is the same in either order and when repeated', () => {
    const a = p({ lessons: ['a1'], days: ['2026-03-05', '2026-03-01'] });
    const b = p({ lessons: ['b1'], puzzles: ['t2-01'] });
    expect(sameLearnProgress(mergeLearnProgress(a, b), mergeLearnProgress(b, a))).toBe(true);
    const m = mergeLearnProgress(a, b);
    expect(sameLearnProgress(mergeLearnProgress(m, m), m)).toBe(true);
    expect(sameLearnProgress(mergeLearnProgress(m, EMPTY_LEARN_PROGRESS), m)).toBe(true);
  });

  it('keeps only the latest 400 days', () => {
    const days = Array.from({ length: 450 }, (_, i) =>
      new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10),
    );
    const m = mergeLearnProgress(p({ days }), EMPTY_LEARN_PROGRESS);
    expect(m.days).toHaveLength(400);
    expect(m.days.at(-1)).toBe(days.at(-1));
  });

  it('tells different progresses apart', () => {
    expect(sameLearnProgress(p({ lessons: ['a'] }), p({ lessons: ['b'] }))).toBe(false);
    expect(sameLearnProgress(p({ lessons: ['a', 'b'] }), p({ lessons: ['b', 'a'] }))).toBe(true);
  });
});
