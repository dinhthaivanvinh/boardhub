import type { Rng } from './types';

/** 32-bit string hash (murmur-style mixing). */
function hashString(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Seeded RNG (mulberry32). Each (seed, stream) pair gives an independent, reproducible sequence.
 * The runner uses stream = -1 for setup and stream = moveIndex for each move.
 */
export function createRng(seed: string, stream: number): Rng {
  let a = hashString(`${seed}:${stream}`);

  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (minInclusive: number, maxExclusive: number): number => {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive) || maxExclusive <= minInclusive) {
      throw new RangeError(`rng.int: invalid range [${minInclusive}, ${maxExclusive})`);
    }
    return minInclusive + Math.floor(next() * (maxExclusive - minInclusive));
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i + 1);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  };

  return { next, int, shuffle };
}
