import type { CaroConfig, CaroSeat } from './types';

/** Horizontal, vertical, diagonal, anti-diagonal. */
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

/**
 * Returns the winning line through `cell` for `seat`, or null.
 * Only lines through the last move are checked, so this is O(size) instead of O(size²).
 */
export function findWinLine(
  board: readonly (CaroSeat | null)[],
  config: CaroConfig,
  cell: number,
  seat: CaroSeat,
): number[] | null {
  const { size, winLength, blockedEndsRule, exactLength } = config;
  const row = Math.floor(cell / size);
  const col = cell % size;
  const inBounds = (r: number, c: number) => r >= 0 && r < size && c >= 0 && c < size;

  for (const [dr, dc] of DIRECTIONS) {
    const line = [cell];

    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c) && board[r * size + c] === seat) {
      line.push(r * size + c);
      r += dr;
      c += dc;
    }
    // Next cell is the board edge or an opponent piece (it cannot be ours: the loop above stopped).
    const forwardBlocked = !inBounds(r, c) || board[r * size + c] !== null;

    r = row - dr;
    c = col - dc;
    while (inBounds(r, c) && board[r * size + c] === seat) {
      line.unshift(r * size + c);
      r -= dr;
      c -= dc;
    }
    const backwardBlocked = !inBounds(r, c) || board[r * size + c] !== null;

    if (line.length < winLength) continue;
    if (exactLength && line.length !== winLength) continue;
    if (blockedEndsRule && forwardBlocked && backwardBlocked) continue;
    return line;
  }
  return null;
}
