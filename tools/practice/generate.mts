/**
 * Makes the practice positions of the piece lessons: `pnpm --filter @bg/game-chess exec tsx ../../../tools/practice/generate.mts`
 * writes packages/games/chess/src/learn/practice-data.ts. The result is fixed (a seeded generator) and every
 * position is checked with the chess engine. Run it again only to change the set.
 *
 *  - star:    White has the piece of the lesson and two other pieces. One empty square holds a star. Only the
 *             piece of the lesson can legally go there.
 *  - capture: White has the piece of the lesson, Black has a king and two or three pieces. The piece of the
 *             lesson can take exactly one of them, and no other white piece can take anything.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  colOf,
  fromFen,
  inCheck,
  legalMoves,
  rowOf,
  squareName,
} from '../../packages/games/chess/src/rules/board.ts';
import type { Piece } from '../../packages/games/chess/src/rules/types.ts';

const PER_KIND = 4;
let seed = 20261124;
const rnd = () => {
  // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (n: number) => Math.floor(rnd() * n);
const pick = <T,>(xs: readonly T[]) => xs[int(xs.length)]!;

type PieceType = 'P' | 'R' | 'B' | 'N' | 'Q' | 'K';
const SQUARES = Array.from({ length: 64 }, (_, i) => i);
const near = (a: number, b: number) =>
  Math.abs(rowOf(a) - rowOf(b)) <= 1 && Math.abs(colOf(a) - colOf(b)) <= 1;

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

/** Puts a piece on a random free square; pawns never stand on the first or last rank. */
function place(board: (Piece | null)[], piece: Piece): number {
  const ok = SQUARES.filter((s) => !board[s] && (piece[1] !== 'P' || (rowOf(s) >= 1 && rowOf(s) <= 6)));
  const s = pick(ok);
  board[s] = piece;
  return s;
}

type Star = { fen: string; star: string; answer: string };
type Capture = { fen: string; from: string; to: string };

function makeStar(type: PieceType): Star | null {
  const board: (Piece | null)[] = Array(64).fill(null);
  const wk = place(board, 'wK');
  const bk = place(board, 'bK');
  if (near(wk, bk)) return null;
  const others = (['R', 'B', 'N', 'Q', 'P'] as const).filter((t) => t !== type);
  // The king of the lesson is the white king itself.
  const mine = type === 'K' ? wk : place(board, `w${type}` as Piece);
  for (let i = 0; i < 2; i++) place(board, `w${pick(others)}` as Piece);
  const fen = fenOf(board);
  const pos = fromFen(fen);
  if (inCheck(pos.board, 'w') || inCheck(pos.board, 'b')) return null;
  const moves = legalMoves(pos).filter((m) => !pos.board[m.to] && !m.promotion);
  const mineTo = moves.filter((m) => m.from === mine).map((m) => m.to);
  if (mineTo.length === 0) return null;
  const star = pick(mineTo);
  // Only the piece of the lesson can go there (promotion squares are left out above).
  const reachers = new Set(
    legalMoves(pos)
      .filter((m) => m.to === star)
      .map((m) => m.from),
  );
  if (reachers.size !== 1 || !reachers.has(mine)) return null;
  // The star should not be next to the piece: a child should have to look.
  if (type !== 'P' && type !== 'K' && near(star, mine)) return null;
  return { fen, star: squareName(star), answer: squareName(mine) };
}

function makeCapture(type: PieceType): Capture | null {
  const board: (Piece | null)[] = Array(64).fill(null);
  const wk = place(board, 'wK');
  const bk = place(board, 'bK');
  if (near(wk, bk)) return null;
  const mine = type === 'K' ? wk : place(board, `w${type}` as Piece);
  const count = 2 + int(2);
  for (let i = 0; i < count; i++) place(board, `b${pick(['P', 'N', 'B', 'R'] as const)}` as Piece);
  const fen = fenOf(board);
  const pos = fromFen(fen);
  if (inCheck(pos.board, 'w') || inCheck(pos.board, 'b')) return null;
  const captures = legalMoves(pos).filter((m) => pos.board[m.to]);
  if (captures.length !== 1) return null;
  const only = captures[0]!;
  if (only.from !== mine || only.promotion) return null;
  return { fen, from: squareName(only.from), to: squareName(only.to) };
}

const out: Record<string, { star: Star[]; capture: Capture[] }> = {};
for (const type of ['P', 'R', 'B', 'N', 'Q', 'K'] as const) {
  const star: Star[] = [];
  const capture: Capture[] = [];
  const seen = new Set<string>();
  let tries = 0;
  while ((star.length < PER_KIND || capture.length < PER_KIND) && tries < 3_000_000) {
    tries++;
    if (star.length < PER_KIND) {
      const s = makeStar(type);
      if (s && !seen.has(s.fen)) {
        seen.add(s.fen);
        star.push(s);
      }
    }
    if (capture.length < PER_KIND) {
      const c = makeCapture(type);
      if (c && !seen.has(c.fen)) {
        seen.add(c.fen);
        capture.push(c);
      }
    }
  }
  if (star.length < PER_KIND || capture.length < PER_KIND)
    throw new Error(`${type}: ${star.length}/${capture.length} after ${tries}`);
  console.log(`${type}: ${star.length} star + ${capture.length} capture in ${tries} tries`);
  out[type] = { star, capture };
}

const file = `// Made by tools/practice/generate.mts: do not edit by hand.
export type StarRound = { fen: string; star: string; answer: string };
export type CaptureRound = { fen: string; from: string; to: string };

export const PIECE_PRACTICE: Record<'P' | 'R' | 'B' | 'N' | 'Q' | 'K', { star: StarRound[]; capture: CaptureRound[] }> = ${JSON.stringify(out, null, 2)};
`;
writeFileSync(
  fileURLToPath(new URL('../../packages/games/chess/src/learn/practice-data.ts', import.meta.url)),
  file,
);
console.log('written');
