import type { Seat } from '@bg/engine';
import { WIN_LENGTH, type FourConfig } from '../rules/config';
import { dropRow, findWinLine } from '../rules/board';
import type { FourMove, FourSeat, FourState } from '../rules/types';

/** Score of a 4-cell window holding n pieces of one colour and none of the other. */
const WINDOW_SCORE = [0, 1, 6, 40, 10_000];
const CENTRE_BONUS = 4;
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

const windowCache = new Map<string, Int16Array>();

/** Every 4-cell line on the board, flattened: cells [i*4 .. i*4+3] form window i. */
function windowsFor({ columns, rows }: FourConfig): Int16Array {
  const key = `${columns}x${rows}`;
  const cached = windowCache.get(key);
  if (cached) return cached;
  const cells: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      for (const [dr, dc] of DIRECTIONS) {
        const endR = r + dr * (WIN_LENGTH - 1);
        const endC = c + dc * (WIN_LENGTH - 1);
        if (endR >= rows || endC < 0 || endC >= columns) continue;
        for (let k = 0; k < WIN_LENGTH; k++) cells.push((r + dr * k) * columns + (c + dc * k));
      }
    }
  }
  const windows = Int16Array.from(cells);
  windowCache.set(key, windows);
  return windows;
}

/** Positional score for `seat`: open lines it can still complete, centre control, minus the opponent's. */
export function evaluate(s: FourState, seat: Seat): number {
  const { columns, rows } = s.config;
  const windows = windowsFor(s.config);
  // The side to move gets a small bonus: its threats are one tempo closer.
  const mineWeight = s.turn === seat ? 1.15 : 1;
  const theirsWeight = s.turn === seat ? 1 : 1.15;
  let total = 0;
  for (let i = 0; i < windows.length; i += WIN_LENGTH) {
    let mine = 0;
    let theirs = 0;
    for (let k = 0; k < WIN_LENGTH; k++) {
      const v = s.board[windows[i + k] as number];
      if (v === null || v === undefined) continue;
      if (v === seat) mine++;
      else theirs++;
    }
    if (theirs === 0) total += (WINDOW_SCORE[mine] as number) * mineWeight;
    else if (mine === 0) total -= (WINDOW_SCORE[theirs] as number) * theirsWeight;
  }
  // Pieces in the centre column take part in the most lines.
  const centre = Math.floor(columns / 2);
  for (let r = 0; r < rows; r++) {
    const v = s.board[r * columns + centre];
    if (v === seat) total += CENTRE_BONUS;
    else if (v !== null && v !== undefined) total -= CENTRE_BONUS;
  }
  return total;
}

function wouldWin(s: FourState, col: number, piece: FourSeat): boolean {
  const row = dropRow(s.board, s.config, col);
  if (row < 0) return false;
  const cell = row * s.config.columns + col;
  const board = s.board.slice();
  board[cell] = piece;
  return findWinLine(board, s.config, cell, piece) !== null;
}

/** Winning moves first, then blocks, then columns closest to the centre. */
export function orderMoves(s: FourState, moves: FourMove[], seat: Seat): FourMove[] {
  const me: FourSeat = seat === 0 ? 0 : 1;
  const opponent: FourSeat = me === 0 ? 1 : 0;
  const centre = (s.config.columns - 1) / 2;
  const scoreOf = (col: number) => {
    if (wouldWin(s, col, me)) return 1_000;
    if (wouldWin(s, col, opponent)) return 500;
    return -Math.abs(col - centre);
  };
  return moves
    .map((m) => ({ m, score: scoreOf(m.col) }))
    .sort((a, b) => b.score - a.score || a.m.col - b.m.col)
    .map((x) => x.m);
}
