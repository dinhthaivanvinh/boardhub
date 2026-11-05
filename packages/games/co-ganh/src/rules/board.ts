import type { CoGanhMove, CoGanhSeat } from './types';

export const SIZE = 5;
export const POINTS = SIZE * SIZE;

type Board = readonly (CoGanhSeat | null)[];

const ORTHOGONAL = [
  [0, 1],
  [1, 0],
] as const;
const DIAGONAL = [
  [1, 1],
  [1, -1],
] as const;

const rowOf = (p: number) => Math.floor(p / SIZE);
const colOf = (p: number) => p % SIZE;
const inside = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

/** Points where (row + col) is even have diagonal lines through them. */
export const isStrongPoint = (p: number) => (rowOf(p) + colOf(p)) % 2 === 0;

/** Line directions through `p` (one per line; each line goes both ways). */
function directionsAt(p: number): readonly (readonly [number, number])[] {
  return isStrongPoint(p) ? [...ORTHOGONAL, ...DIAGONAL] : ORTHOGONAL;
}

function step(p: number, dr: number, dc: number): number | null {
  const r = rowOf(p) + dr;
  const c = colOf(p) + dc;
  return inside(r, c) ? r * SIZE + c : null;
}

/** Points joined to `p` by a line. */
export const NEIGHBOURS: readonly (readonly number[])[] = Array.from({ length: POINTS }, (_, p) =>
  directionsAt(p)
    .flatMap(([dr, dc]) => [step(p, dr, dc), step(p, -dr, -dc)])
    .filter((q): q is number => q !== null)
    .sort((a, b) => a - b),
);

/** The two points on either side of `p` on each line through it (both on the board). */
const LINE_PAIRS: readonly (readonly [number, number])[][] = Array.from({ length: POINTS }, (_, p) =>
  directionsAt(p).flatMap(([dr, dc]) => {
    const a = step(p, dr, dc);
    const b = step(p, -dr, -dc);
    return a !== null && b !== null ? [[a, b] as const] : [];
  }),
);

export const other = (s: CoGanhSeat): CoGanhSeat => (s === 0 ? 1 : 0);

/** Enemy pieces carried ("gánh") by a piece of `piece` standing on `p`. */
export function carriedAt(board: Board, p: number, piece: CoGanhSeat): number[] {
  const enemy = other(piece);
  return LINE_PAIRS[p]!.flatMap(([a, b]) => (board[a] === enemy && board[b] === enemy ? [a, b] : []));
}

/** Pieces of `side` in groups with no empty neighbouring point ("vây"). */
export function surroundedPieces(board: Board, side: CoGanhSeat): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (let start = 0; start < POINTS; start++) {
    if (board[start] !== side || seen.has(start)) continue;
    const group: number[] = [];
    let free = false;
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const p = stack.pop()!;
      group.push(p);
      for (const q of NEIGHBOURS[p]!) {
        if (board[q] === null) free = true;
        else if (board[q] === side && !seen.has(q)) {
          seen.add(q);
          stack.push(q);
        }
      }
    }
    if (!free) out.push(...group);
  }
  return out.sort((a, b) => a - b);
}

/** Every step of `side` to an empty neighbouring point, ignoring the "mở" rule. */
export function plainMoves(board: Board, side: CoGanhSeat): CoGanhMove[] {
  const moves: CoGanhMove[] = [];
  for (let from = 0; from < POINTS; from++) {
    if (board[from] !== side) continue;
    for (const to of NEIGHBOURS[from]!) if (board[to] === null) moves.push({ from, to });
  }
  return moves;
}

/** Moves into `point` that carry at least one pair: the moves forced by "mở". */
export function openingMoves(board: Board, side: CoGanhSeat, point: number): CoGanhMove[] {
  if (board[point] !== null) return [];
  const moves: CoGanhMove[] = [];
  for (const from of NEIGHBOURS[point]!) {
    if (board[from] !== side) continue;
    const after = board.slice();
    after[from] = null;
    if (carriedAt(after, point, side).length > 0) moves.push({ from, to: point });
  }
  return moves;
}

/** Board after `move`, with every capture applied. */
export function playOnBoard(
  board: Board,
  move: CoGanhMove,
): { board: (CoGanhSeat | null)[]; carried: number[]; surrounded: number[] } {
  const piece = board[move.from]!;
  const next = board.slice();
  next[move.from] = null;
  next[move.to] = piece;
  const carried = carriedAt(next, move.to, piece);
  for (const p of carried) next[p] = piece;
  const surrounded = surroundedPieces(next, other(piece));
  for (const p of surrounded) next[p] = piece;
  return { board: next, carried, surrounded };
}

export function countPieces(board: Board): [number, number] {
  let red = 0;
  let blue = 0;
  for (const v of board) {
    if (v === 0) red++;
    else if (v === 1) blue++;
  }
  return [red, blue];
}

export const pointOf = (row: number, col: number) => row * SIZE + col;
