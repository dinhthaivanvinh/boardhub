import type { ReversiSeat } from './types';

type Board = readonly (ReversiSeat | null)[];

const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

/** Opponent discs that placing `piece` on `cell` would flip (empty if the move is illegal). */
export function flipsFor(board: Board, size: number, cell: number, piece: ReversiSeat): number[] {
  if (board[cell] !== null) return [];
  const opponent = piece === 0 ? 1 : 0;
  const row = Math.floor(cell / size);
  const col = cell % size;
  const flips: number[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const line: number[] = [];
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === opponent) {
      line.push(r * size + c);
      r += dr;
      c += dc;
    }
    // The run must be closed by one of our own discs, not by the edge or an empty cell.
    if (line.length > 0 && r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === piece) {
      flips.push(...line);
    }
  }
  return flips;
}

/** Cells where `piece` can play, in board order. */
export function legalCells(board: Board, size: number, piece: ReversiSeat): number[] {
  const cells: number[] = [];
  for (let cell = 0; cell < board.length; cell++) {
    if (board[cell] === null && flipsFor(board, size, cell, piece).length > 0) cells.push(cell);
  }
  return cells;
}

export function countDiscs(board: Board): [number, number] {
  let black = 0;
  let white = 0;
  for (const v of board) {
    if (v === 0) black++;
    else if (v === 1) white++;
  }
  return [black, white];
}
