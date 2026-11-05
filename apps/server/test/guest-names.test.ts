import { describe, expect, it } from 'vitest';
import { randomGuestName } from '../src/auth/auth-service';

describe('guest names', () => {
  it('look like "Animal Adjective 1234" and rarely repeat', () => {
    const names = Array.from({ length: 2_000 }, () => randomGuestName());
    for (const n of names.slice(0, 50)) expect(n).toMatch(/^\p{L}+ \p{L}+ \d{4}$/u);
    // With ~2.3 million combinations, 2,000 draws should almost never collide.
    expect(new Set(names).size).toBeGreaterThan(1_990);
  });

  it('are deterministic for a given random source', () => {
    expect(randomGuestName(() => 0)).toBe('Hổ Nhanh 1000');
    expect(randomGuestName(() => 0.9999)).toBe('Cú Xinh 9999');
  });
});
