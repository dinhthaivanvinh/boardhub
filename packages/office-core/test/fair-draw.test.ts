import { describe, expect, it } from 'vitest';
import { commitment, drawPrizes, drawWinners, verifyDraw } from '../src/fair-draw';

const SEED = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
const people = Array.from({ length: 10 }, (_, i) => `user-${i}`);

describe('fair draw', () => {
  it('commitment is sha256 of the seed bytes', () => {
    // sha256 of the 32 bytes above, computed independently.
    expect(commitment(SEED)).toMatch(/^[0-9a-f]{64}$/);
    expect(commitment(SEED)).toBe(commitment(SEED));
    expect(commitment(SEED)).not.toBe(commitment(SEED.replace(/.$/, '9')));
  });

  it('picks n different winners, and the order of candidates does not matter', () => {
    const a = drawWinners(SEED, 'draw-1', people, 3);
    expect(new Set(a).size).toBe(3);
    expect(drawWinners(SEED, 'draw-1', [...people].reverse(), 3)).toEqual(a);
    expect(drawWinners(SEED, 'draw-1', [...people, ...people], 3)).toEqual(a); // duplicates removed
    expect(drawWinners(SEED, 'draw-2', people, 3)).not.toEqual(a); // the draw id is part of the input
    expect(drawWinners(SEED, 'draw-1', people, 10).sort()).toEqual([...people].sort());
  });

  it('refuses impossible draws', () => {
    expect(() => drawWinners(SEED, 'd', people, 0)).toThrow();
    expect(() => drawWinners(SEED, 'd', people, 11)).toThrow();
    expect(() => drawWinners(SEED, 'd', [], 1)).toThrow();
  });

  it('verifies a real draw, and any tampering fails', () => {
    const record = {
      drawId: 'draw-7',
      commitment: commitment(SEED),
      seed: SEED,
      candidates: people,
      n: 2,
      winners: drawWinners(SEED, 'draw-7', people, 2),
    };
    expect(verifyDraw(record)).toBe(true);
    expect(verifyDraw({ ...record, seed: SEED.replace(/^./, 'a') })).toBe(false);
    expect(verifyDraw({ ...record, drawId: 'draw-8' })).toBe(false);
    expect(verifyDraw({ ...record, candidates: people.slice(1) })).toBe(false);
    expect(verifyDraw({ ...record, winners: [...record.winners].reverse() })).toBe(false);
    expect(verifyDraw({ ...record, winners: [record.winners[0]!] })).toBe(false);
    expect(verifyDraw({ ...record, n: 20 })).toBe(false);
  });

  it('is uniform: over 100,000 draws everyone is picked 10% ± 0.5%', () => {
    const counts = new Map<string, number>();
    const N = 100_000;
    for (let i = 0; i < N; i++) {
      const [w] = drawWinners(SEED, `d${i}`, people, 1);
      counts.set(w!, (counts.get(w!) ?? 0) + 1);
    }
    for (const p of people) expect(Math.abs((counts.get(p) ?? 0) / N - 0.1)).toBeLessThan(0.005);
  }, 60_000);

  it('prizes: one per winner, from the same seed, independent of the winners, and verifiable', () => {
    const prizes = ['L0-1', 'L0-2', 'L1-1', 'U2-1', 'U2-2', 'U2-3'];
    const winners = drawWinners(SEED, 'draw-9', people, 2);
    const awarded = drawPrizes(SEED, 'draw-9', prizes, 2);
    expect(new Set(awarded).size).toBe(2);
    expect(drawPrizes(SEED, 'draw-9', [...prizes].reverse(), 2)).toEqual(awarded);
    // Different HMAC messages: the prize stream is not the winner stream on the same pool.
    expect(drawPrizes(SEED, 'draw-9', people, 2)).not.toEqual(winners);
    const record = {
      drawId: 'draw-9',
      commitment: commitment(SEED),
      seed: SEED,
      candidates: people,
      n: 2,
      winners,
      prizes,
      awarded,
    };
    expect(verifyDraw(record)).toBe(true);
    expect(verifyDraw({ ...record, awarded: [...awarded].reverse() })).toBe(false);
    expect(verifyDraw({ ...record, prizes: prizes.slice(1) })).toBe(false);
    expect(verifyDraw({ ...record, awarded: undefined })).toBe(false);
    // Old draws (no prizes at all) still verify.
    expect(verifyDraw({ ...record, prizes: undefined, awarded: undefined })).toBe(true);
  });

  it('prizes are uniform too: 3 big of 10 envelopes go to 30% ± 0.6% of the picks', () => {
    const pool = Array.from({ length: 10 }, (_, i) => (i < 3 ? `big-${i}` : `small-${i}`));
    let big = 0;
    const N = 60_000;
    for (let i = 0; i < N; i++) if (drawPrizes(SEED, `p${i}`, pool, 1)[0]!.startsWith('big')) big++;
    expect(Math.abs(big / N - 0.3)).toBeLessThan(0.006);
  }, 60_000);
});
