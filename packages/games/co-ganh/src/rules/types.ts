/** Seat 0 plays Red and moves first (bottom), seat 1 plays Blue. */
export type CoGanhSeat = 0 | 1;

export type CoGanhMove = { from: number; to: number };

export type CoGanhStatus = 'playing' | 'all_taken' | 'move_limit';

export type CoGanhConfig = Record<string, never>;

export type CoGanhState = {
  config: CoGanhConfig;
  /** 25 points, index = row * 5 + col; row 0 is Blue's side. */
  board: (CoGanhSeat | null)[];
  turn: CoGanhSeat;
  moveCount: number;
  lastMove: CoGanhMove | null;
  /** Pieces converted by "gánh" on the last move (for the animation). */
  carried: number[];
  /** Pieces converted by "vây" (surrounded) on the last move. */
  surrounded: number[];
  /** "Mở": the point the side to move must move into, capturing by gánh. */
  forced: number | null;
  /** Plies in a row without any piece changing colour. */
  sinceCapture: number;
  status: CoGanhStatus;
  winner: CoGanhSeat | null;
};
