import { describe, expect, it } from 'vitest';
import { DEFAULT_RATING, isProvisional, rateGame, updateRating } from '../src/ratings/glicko2';

describe('Glicko-2', () => {
  it("matches the worked example from Glickman's paper", () => {
    const player = { rating: 1500, rd: 200, volatility: 0.06 };
    const next = updateRating(player, [
      { opponent: { rating: 1400, rd: 30, volatility: 0.06 }, score: 1 },
      { opponent: { rating: 1550, rd: 100, volatility: 0.06 }, score: 0 },
      { opponent: { rating: 1700, rd: 300, volatility: 0.06 }, score: 0 },
    ]);
    expect(next.rating).toBeCloseTo(1464.06, 1);
    expect(next.rd).toBeCloseTo(151.52, 1);
    expect(next.volatility).toBeCloseTo(0.05999, 4);
  });

  it('a new player who wins gains a lot, the loser loses the same', () => {
    const [a, b] = rateGame(DEFAULT_RATING, DEFAULT_RATING, 1);
    expect(a.rating).toBeGreaterThan(1650);
    expect(b.rating).toBeLessThan(1350);
    expect(a.rating - 1500).toBeCloseTo(1500 - b.rating, 6);
    expect(a.rd).toBeLessThan(350);
  });

  it('a draw between equals changes nothing but the deviation', () => {
    const [a, b] = rateGame(DEFAULT_RATING, DEFAULT_RATING, 0.5);
    expect(a.rating).toBeCloseTo(1500, 6);
    expect(b.rating).toBeCloseTo(1500, 6);
    expect(a.rd).toBeLessThan(350);
  });

  it('beating a much stronger player is worth more than beating a weaker one', () => {
    const me = { rating: 1500, rd: 80, volatility: 0.06 };
    const [vsStrong] = rateGame(me, { rating: 1900, rd: 80, volatility: 0.06 }, 1);
    const [vsWeak] = rateGame(me, { rating: 1100, rd: 80, volatility: 0.06 }, 1);
    expect(vsStrong.rating - 1500).toBeGreaterThan((vsWeak.rating - 1500) * 3);
  });

  it('RD stays within bounds, and an idle period only grows it', () => {
    let r = { rating: 2000, rd: 40, volatility: 0.06 };
    for (let i = 0; i < 50; i++) r = rateGame(r, { rating: 1000, rd: 50, volatility: 0.06 }, 1)[0];
    expect(r.rd).toBeGreaterThanOrEqual(30);
    const idle = updateRating({ rating: 1600, rd: 100, volatility: 0.06 }, []);
    expect(idle.rating).toBe(1600);
    expect(idle.rd).toBeGreaterThan(100);
    expect(updateRating({ ...DEFAULT_RATING }, []).rd).toBe(350);
  });

  it('flags provisional ratings', () => {
    expect(isProvisional(DEFAULT_RATING)).toBe(true);
    expect(isProvisional({ rd: 60 })).toBe(false);
  });
});
