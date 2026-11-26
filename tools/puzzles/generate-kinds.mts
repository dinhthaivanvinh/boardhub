/**
 * Makes the puzzles that are not "mate in one": `pnpm --filter @bg/server exec tsx ../../tools/puzzles/generate-kinds.mts`
 * writes packages/games/chess/src/learn/puzzle-kinds-data.ts. Seeded, so the result is fixed; every position
 * passes `isFairPuzzle`, which a test checks again.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { colOf, fromFen, rowOf } from '../../packages/games/chess/src/rules/board.ts';
import type { Piece } from '../../packages/games/chess/src/rules/types.ts';
import {
  isFairPuzzle,
  SKILL_KINDS,
  type SkillKind,
} from '../../packages/games/chess/src/learn/puzzle-kinds.ts';

const PER_KIND = 30;
const PREFIX: Record<SkillKind, string> = { free: 'free', save: 'save', fork: 'fork', mate2: 'two' };

let seed = 20261126;
const rnd = () => {
  // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (n: number) => Math.floor(rnd() * n);
const pick = <T,>(xs: readonly T[]) => xs[int(xs.length)]!;

type Recipe = { white: string[]; black: string[]; blackKingOnEdge?: boolean };

const RECIPES: Record<SkillKind, () => Recipe> = {
  free: () => ({
    white: pick([
      ['N', 'B', 'P'],
      ['R', 'N', 'P'],
      ['Q', 'N', 'P'],
      ['R', 'B', 'P', 'P'],
      ['N', 'R'],
    ]),
    black: pick([
      ['N', 'B', 'P', 'P'],
      ['R', 'N', 'P', 'P'],
      ['B', 'B', 'P'],
      ['N', 'N', 'P', 'P'],
    ]),
  }),
  save: () => ({
    white: pick([
      ['N', 'P', 'P'],
      ['R', 'P', 'P'],
      ['B', 'N', 'P'],
      ['Q', 'P', 'P'],
      ['R', 'N', 'P'],
    ]),
    black: pick([
      ['N', 'P', 'P'],
      ['B', 'P', 'P'],
      ['R', 'P'],
      ['B', 'N', 'P'],
      ['P', 'P', 'P'],
    ]),
  }),
  fork: () => ({
    white: pick([
      ['N', 'P', 'P'],
      ['N', 'N', 'P'],
      ['Q', 'P'],
      ['B', 'P', 'P'],
      ['R', 'P'],
      ['P', 'P', 'N'],
    ]),
    black: pick([
      ['R', 'P', 'P'],
      ['R', 'N', 'P'],
      ['Q', 'P'],
      ['R', 'R'],
      ['B', 'N', 'P'],
    ]),
  }),
  mate2: () => ({
    white: pick([['Q'], ['R', 'R'], ['Q', 'R'], ['Q', 'N'], ['R', 'B'], ['Q', 'B'], ['R', 'N']]),
    black: pick([[], ['P'], ['P', 'P'], ['P', 'P', 'P'], ['N']]),
    blackKingOnEdge: true,
  }),
};

const SQUARES = Array.from({ length: 64 }, (_, i) => i);

function fenOf(board: (Piece | null)[]): string {
  const rows = Array.from({ length: 8 }, (_, r) => {
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
      row += p[0] === 'w' ? p[1] : p[1]!.toLowerCase();
    }
    return row + (empty || '');
  });
  return `${rows.join('/')} w - -`;
}

function randomFen(recipe: Recipe): string {
  const board: (Piece | null)[] = Array(64).fill(null);
  const free = () => SQUARES.filter((s) => !board[s]);
  const edge = (s: number) => rowOf(s) === 0 || rowOf(s) === 7 || colOf(s) === 0 || colOf(s) === 7;
  const bk = pick(recipe.blackKingOnEdge ? SQUARES.filter(edge) : SQUARES);
  board[bk] = 'bK';
  const near = (a: number, b: number) =>
    Math.abs(rowOf(a) - rowOf(b)) <= 1 && Math.abs(colOf(a) - colOf(b)) <= 1;
  board[pick(free().filter((s) => !near(s, bk)))] = 'wK';
  for (const [color, pieces] of [
    ['w', recipe.white],
    ['b', recipe.black],
  ] as const) {
    for (const t of pieces) {
      const ok = free().filter((s) => (t === 'P' ? rowOf(s) >= 1 && rowOf(s) <= 6 : true));
      // White pawns do not stand one step from promoting.
      const safe = t === 'P' && color === 'w' ? ok.filter((s) => rowOf(s) >= 2) : ok;
      board[pick(safe)] = `${color}${t}` as Piece;
    }
  }
  return fenOf(board);
}

const out: string[] = [];
for (const kind of SKILL_KINDS) {
  const found = new Set<string>();
  let tries = 0;
  const started = Date.now();
  while (found.size < PER_KIND && tries < 3_000_000) {
    tries++;
    const fen = randomFen(RECIPES[kind]());
    if (!found.has(fen) && isFairPuzzle(kind, fromFen(fen))) found.add(fen);
  }
  if (found.size < PER_KIND) throw new Error(`${kind}: only ${found.size} after ${tries} tries`);
  console.log(
    `${kind}: ${found.size} puzzles in ${tries} tries, ${Math.round((Date.now() - started) / 1000)}s`,
  );
  [...found].forEach((fen, i) =>
    out.push(
      `  { id: '${PREFIX[kind]}-${String(i + 1).padStart(2, '0')}', kind: '${kind}', fen: '${fen}' },`,
    ),
  );
}

writeFileSync(
  fileURLToPath(new URL('../../packages/games/chess/src/learn/puzzle-kinds-data.ts', import.meta.url)),
  `// Made by tools/puzzles/generate-kinds.mts: do not edit by hand. White to move.
import type { SkillPuzzle } from './puzzles';

export const SKILL_PUZZLE_DATA: readonly SkillPuzzle[] = [
${out.join('\n')}
];
`,
);
console.log('written');
