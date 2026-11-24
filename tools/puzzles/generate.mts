/**
 * Makes the "mate in one" puzzles of the Puzzles page: `pnpm --filter @bg/game-chess exec tsx ../../../tools/puzzles/generate.mts`
 * writes packages/games/chess/src/learn/puzzle-data.ts. The result is fixed (a seeded generator), and every
 * position is checked with the chess engine, so no puzzle can be wrong. Run it again only to change the set.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  colOf,
  fromFen,
  inCheck,
  legalMoves,
  makeMove,
  rowOf,
} from '../../packages/games/chess/src/rules/board.ts';
import type { Piece } from '../../packages/games/chess/src/rules/types.ts';

const PER_TIER = 50;
let seed = 20260101;
const rnd = () => {
  // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (n: number) => Math.floor(rnd() * n);
const pick = <T,>(xs: readonly T[]) => xs[int(xs.length)]!;

type Tier = 1 | 2 | 3;
type Recipe = { white: string[]; black: string[]; maxMates: number; minChecks: number };

// White always has the king plus these; Black always has the king plus these.
const RECIPES: Record<Tier, () => Recipe> = {
  1: () => ({
    white: [pick(['Q', 'R', 'R', 'Q'])],
    black: pick([[], [], ['P'], ['P', 'P']]),
    maxMates: 1,
    minChecks: 1,
  }),
  2: () => ({
    white: pick([
      ['Q', 'R'],
      ['R', 'R'],
      ['Q', 'B'],
      ['Q', 'N'],
      ['R', 'B'],
      ['R', 'N'],
      ['Q', 'P'],
    ]),
    black: pick([['P', 'P'], ['P', 'P', 'P'], ['P'], ['N'], ['P', 'P', 'P', 'P']]),
    maxMates: 1,
    minChecks: 2,
  }),
  3: () => ({
    white: pick([
      ['Q', 'B', 'N'],
      ['R', 'B', 'N'],
      ['Q', 'R', 'P'],
      ['R', 'B', 'B'],
      ['Q', 'N', 'P'],
      ['R', 'N', 'P'],
    ]),
    black: pick([
      ['P', 'P', 'P'],
      ['P', 'P', 'N'],
      ['P', 'P', 'B'],
      ['P', 'P', 'R'],
      ['P', 'P', 'P', 'N'],
    ]),
    maxMates: 1,
    minChecks: 3,
  }),
};

const SQUARES = Array.from({ length: 64 }, (_, i) => i);

function fenOf(board: (Piece | null)[]): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let row = '';
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = board[r * 8 + c];
      if (!p) {
        empty++;
        continue;
      }
      if (empty) row += empty;
      empty = 0;
      row += p[0] === 'w' ? p[1] : p[1].toLowerCase();
    }
    rows.push(row + (empty || ''));
  }
  return `${rows.join('/')} w - -`;
}

/** A random position for the recipe: the black king on an edge (it is the one to be mated), nothing silly. */
function randomPosition(recipe: Recipe): (Piece | null)[] | null {
  const board: (Piece | null)[] = Array(64).fill(null);
  const free = () => SQUARES.filter((s) => !board[s]);
  const edge = SQUARES.filter((s) => rowOf(s) === 0 || rowOf(s) === 7 || colOf(s) === 0 || colOf(s) === 7);
  const bk = pick(edge);
  board[bk] = 'bK';
  const near = (a: number, b: number) =>
    Math.abs(rowOf(a) - rowOf(b)) <= 1 && Math.abs(colOf(a) - colOf(b)) <= 1;
  const wk = pick(free().filter((s) => !near(s, bk)));
  board[wk] = 'wK';
  for (const t of recipe.white) {
    const ok = free().filter((s) => (t === 'P' ? rowOf(s) >= 2 && rowOf(s) <= 6 : true));
    board[pick(ok)] = `w${t}` as Piece;
  }
  for (const t of recipe.black) {
    const ok = free().filter((s) => (t === 'P' ? rowOf(s) >= 1 && rowOf(s) <= 6 : true));
    board[pick(ok)] = `b${t}` as Piece;
  }
  return board;
}

function tryMake(tier: Tier): string | null {
  const recipe = RECIPES[tier]();
  const board = randomPosition(recipe);
  if (!board) return null;
  const fen = fenOf(board);
  const pos = fromFen(fen);
  if (inCheck(pos.board, 'b')) return null; // Black cannot be in check with White to move
  if (inCheck(pos.board, 'w')) return null;
  const moves = legalMoves(pos);
  // No promotions: a child should not meet the choice of a piece here.
  if (moves.some((m) => m.promotion)) return null;
  const mates = moves.filter((m) => {
    const after = makeMove(pos, m);
    return legalMoves(after).length === 0 && inCheck(after.board, 'b');
  });
  if (mates.length === 0 || mates.length > recipe.maxMates) return null;
  const checks = moves.filter((m) => inCheck(makeMove(pos, m).board, 'b')).length;
  if (checks < recipe.minChecks) return null;
  // A mate that needs a real idea: not a capture that happens to give mate on a crowded board.
  const mate = mates[0]!;
  if (tier === 1 && moves.length < 6) return null;
  if (pos.board[mate.to] && tier !== 3) return null;
  return fen;
}

const out: Record<Tier, string[]> = { 1: [], 2: [], 3: [] };
for (const tier of [1, 2, 3] as Tier[]) {
  const seen = new Set<string>();
  let tries = 0;
  while (out[tier].length < PER_TIER && tries < 5_000_000) {
    tries++;
    const fen = tryMake(tier);
    if (!fen || seen.has(fen)) continue;
    seen.add(fen);
    out[tier].push(fen);
  }
  if (out[tier].length < PER_TIER)
    throw new Error(`tier ${tier}: only ${out[tier].length} after ${tries} tries`);
  console.log(`tier ${tier}: ${out[tier].length} puzzles in ${tries} tries`);
}

const lines = ([1, 2, 3] as Tier[]).flatMap((tier) =>
  out[tier].map(
    (fen, i) => `  { id: 't${tier}-${String(i + 1).padStart(2, '0')}', tier: ${tier}, fen: '${fen}' },`,
  ),
);
const file = `// Made by tools/puzzles/generate.mts: do not edit by hand. Every position has White to move and a checkmate in one.
import type { Puzzle } from './puzzles';

export const PUZZLE_DATA: readonly Puzzle[] = [
${lines.join('\n')}
];
`;
writeFileSync(
  fileURLToPath(new URL('../../packages/games/chess/src/learn/puzzle-data.ts', import.meta.url)),
  file,
);
console.log('written');
