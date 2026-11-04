import { WIN_LENGTH, type FourConfig } from './config';
import type { FourSeat } from './types';

type Board = readonly (FourSeat | null)[];

/** Row where a piece dropped in `col` lands, or -1 if the column is full. */
export function dropRow(board: Board, config: FourConfig, col: number): number {
  for (let row = config.rows - 1; row >= 0; row--) {
    if (board[row * config.columns + col] === null) return row;
  }
  return -1;
}

/** Horizontal, vertical, diagonal, anti-diagonal. */
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

/** Longest line of `piece` through `cell` if it has at least 4 pieces, else null. */
export function findWinLine(
  board: Board,
  config: FourConfig,
  cell: number,
  piece: FourSeat,
): number[] | null {
  const { columns, rows } = config;
  const row = Math.floor(cell / columns);
  const col = cell % columns;
  const inBounds = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < columns;

  for (const [dr, dc] of DIRECTIONS) {
    const line = [cell];
    for (
      let r = row + dr, c = col + dc;
      inBounds(r, c) && board[r * columns + c] === piece;
      r += dr, c += dc
    ) {
      line.push(r * columns + c);
    }
    for (
      let r = row - dr, c = col - dc;
      inBounds(r, c) && board[r * columns + c] === piece;
      r -= dr, c -= dc
    ) {
      line.unshift(r * columns + c);
    }
    if (line.length >= WIN_LENGTH) return line;
  }
  return null;
}
