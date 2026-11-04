import type { FourConfig } from './config';

/** Seat 0 plays Yellow and moves first, seat 1 plays Red. */
export type FourSeat = 0 | 1;

export type FourMove = { col: number };

export type FourState = {
  config: FourConfig;
  /** cell = row * columns + col, row 0 is the TOP row. */
  board: (FourSeat | null)[];
  turn: FourSeat;
  moveCount: number;
  /** Cell where the last piece landed. */
  lastMove: number | null;
  winner: FourSeat | null;
  /** Cells of the winning line, in order. */
  winLine: number[] | null;
};

export type { FourConfig };
