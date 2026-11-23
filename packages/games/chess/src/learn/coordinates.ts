import { FILES } from '../rules/board';

/** The five kinds of exercise of the coordinates lesson, easiest first. */
export type CoordKind = 'rank' | 'file' | 'cross' | 'find' | 'treasure';
export const COORD_KINDS: readonly CoordKind[] = ['rank', 'file', 'cross', 'find', 'treasure'];

export type CoordRound = {
  /** The square asked for (a row for `rank`, a column for `file`: any square on it counts). */
  square: number;
  /** `treasure` only: three names to choose from, one of them is `square`. */
  options?: number[];
};

/** Rank number 1–8 of a square index (row 0 is rank 8). */
export const rankOf = (square: number) => 8 - (square >> 3);
/** File letter a–h of a square index. */
export const fileOf = (square: number) => FILES[square & 7]!;

/** A small seeded generator: lessons must be the same every time, so tests can rely on them. */
function generator(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const int = (n: number) => Math.floor(next() * n);
  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };
  return { int, shuffle };
}

/** Squares one step away on the same file or the same rank: the names a child mixes up. */
function neighbours(square: number): number[] {
  const row = square >> 3;
  const col = square & 7;
  const vertical = row > 0 ? square - 8 : square + 8;
  const horizontal = col > 0 ? square - 1 : square + 1;
  return [vertical, horizontal];
}

/** `count` rounds of one kind. Always the same for the same arguments. */
export function coordRounds(kind: CoordKind, count = 5): CoordRound[] {
  const rng = generator(COORD_KINDS.indexOf(kind) + 1);
  if (kind === 'rank' || kind === 'file') {
    // Different rows (or columns) every round; the square is only where the question is drawn from.
    return rng
      .shuffle([0, 1, 2, 3, 4, 5, 6, 7])
      .slice(0, count)
      .map((line) => ({ square: kind === 'rank' ? line * 8 + rng.int(8) : rng.int(8) * 8 + line }));
  }
  const squares = rng.shuffle(Array.from({ length: 64 }, (_, i) => i)).slice(0, count);
  return squares.map((square) =>
    kind === 'treasure' ? { square, options: rng.shuffle([square, ...neighbours(square)]) } : { square },
  );
}
