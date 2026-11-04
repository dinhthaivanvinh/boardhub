import type { ReversiConfig } from './config';

/** Seat 0 plays Black and moves first, seat 1 plays White. */
export type ReversiSeat = 0 | 1;

export type ReversiMove = { cell: number };

export type ReversiState = {
  config: ReversiConfig;
  board: (ReversiSeat | null)[];
  turn: ReversiSeat;
  moveCount: number;
  lastMove: number | null;
  /** Cells flipped by the last move (for the flip animation). */
  flipped: number[];
  /** The side that just lost its turn because it had no legal move. */
  passed: ReversiSeat | null;
  /** Neither side can move. */
  over: boolean;
};

export type { ReversiConfig };
