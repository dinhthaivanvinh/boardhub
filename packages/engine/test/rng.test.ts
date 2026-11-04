import { describe, expect, it } from 'vitest';
import { createRng } from '../src';

describe('createRng', () => {
  it('gives the same sequence for the same seed and stream', () => {
    const a = createRng('seed', 3);
    const b = createRng('seed', 3);
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(Array.from({ length: 20 }, () => b.next()));
  });

  it('gives different sequences for different streams or seeds', () => {
    expect(createRng('seed', 1).next()).not.toBe(createRng('seed', 2).next());
    expect(createRng('seed-a', 1).next()).not.toBe(createRng('seed-b', 1).next());
  });

  it('next() stays in [0, 1)', () => {
    const rng = createRng('range', 0);
    for (let i = 0; i < 10_000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('int() covers the whole range and nothing outside it', () => {
    const rng = createRng('int', 0);
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) seen.add(rng.int(-2, 3));
    expect([...seen].sort((x, y) => x - y)).toEqual([-2, -1, 0, 1, 2]);
  });

  it('int() rejects empty or non-integer ranges', () => {
    const rng = createRng('bad', 0);
    expect(() => rng.int(3, 3)).toThrow(RangeError);
    expect(() => rng.int(0, 1.5)).toThrow(RangeError);
  });

  it('shuffle() returns a new permutation and leaves the input alone', () => {
    const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
    const out = createRng('shuffle', 0).shuffle(input);
    expect(out).not.toBe(input);
    expect([...out].sort()).toEqual([...input]);
    expect(out).not.toEqual(input);
  });
});
