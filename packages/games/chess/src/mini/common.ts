/**
 * Small games with a few pieces and no kings, so the chess engine (which needs kings) is not used. Pure: no
 * I/O, no randomness except what is passed in. White is the child and moves up the board.
 */
import { colOf, rowOf, squareOf } from '../rules/board';
import type { ChessMove, Piece } from '../rules/types';

export type MiniBoard = readonly (Piece | null)[];

export type MiniGameId = 'knight-stars' | 'rook-wall' | 'pawn-race';
export const MINI_GAME_IDS: readonly MiniGameId[] = ['knight-stars', 'rook-wall', 'pawn-race'];

export const emptyBoard = (): (Piece | null)[] => Array<Piece | null>(64).fill(null);

export const boardWith = (pieces: Partial<Record<Piece, string[]>>): (Piece | null)[] => {
  const board = emptyBoard();
  for (const [piece, squares] of Object.entries(pieces)) {
    for (const name of squares) board[squareOf(name)] = piece as Piece;
  }
  return board;
};

export const apply = (board: MiniBoard, move: ChessMove): (Piece | null)[] => {
  const next = [...board];
  next[move.to] = next[move.from]!;
  next[move.from] = null;
  return next;
};

export const at = (row: number, col: number): number | null =>
  row >= 0 && row < 8 && col >= 0 && col < 8 ? row * 8 + col : null;

const KNIGHT_STEPS = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
] as const;

/** The squares a knight reaches from `from` on an empty board. */
export const knightSquares = (from: number): number[] =>
  KNIGHT_STEPS.flatMap(([dr, dc]) => {
    const s = at(rowOf(from) + dr, colOf(from) + dc);
    return s === null ? [] : [s];
  });

/** The squares a rook slides to: it stops before its own colour and on the first piece of the other. */
export function rookSquares(board: MiniBoard, from: number): number[] {
  const mine = board[from]![0];
  const out: number[] = [];
  for (const [dr, dc] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const) {
    for (let k = 1; ; k++) {
      const s = at(rowOf(from) + dr * k, colOf(from) + dc * k);
      if (s === null) break;
      const there = board[s];
      if (there?.[0] === mine) break;
      out.push(s);
      if (there) break;
    }
  }
  return out;
}

/** The two squares a pawn of `color` attacks from `from`. */
export const pawnAttacks = (from: number, color: 'w' | 'b'): number[] =>
  [-1, 1].flatMap((dc) => {
    const s = at(rowOf(from) + (color === 'w' ? -1 : 1), colOf(from) + dc);
    return s === null ? [] : [s];
  });

/** A pawn's moves: one step (two from its start) onto empty squares, captures diagonally, and en passant. */
export function pawnMoves(board: MiniBoard, from: number, enPassant: number | null = null): ChessMove[] {
  const color = board[from]![0] as 'w' | 'b';
  const dir = color === 'w' ? -1 : 1;
  const out: ChessMove[] = [];
  const one = at(rowOf(from) + dir, colOf(from));
  if (one !== null && !board[one]) {
    out.push({ from, to: one });
    const startRow = color === 'w' ? 6 : 1;
    const two = at(rowOf(from) + 2 * dir, colOf(from));
    if (rowOf(from) === startRow && two !== null && !board[two]) out.push({ from, to: two });
  }
  for (const to of pawnAttacks(from, color)) {
    const there = board[to];
    if ((there && there[0] !== color) || (!there && to === enPassant)) out.push({ from, to });
  }
  return out;
}

/** The squares of the pieces of a colour, in board order. */
export const squaresOf = (board: MiniBoard, color: 'w' | 'b'): number[] =>
  board.flatMap((p, s) => (p?.[0] === color ? [s] : []));
