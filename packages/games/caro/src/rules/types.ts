import type { CaroConfig } from './config';

/** Seat 0 plays X and moves first, seat 1 plays O. */
export type CaroSeat = 0 | 1;

/** cell = row * size + col, with (0, 0) at the top-left. */
export type CaroMove = { cell: number };

export type CaroState = {
  config: CaroConfig;
  board: (CaroSeat | null)[];
  turn: CaroSeat;
  moveCount: number;
  lastMove: number | null;
  winner: CaroSeat | null;
  winLine: number[] | null;
};

export type { CaroConfig };
