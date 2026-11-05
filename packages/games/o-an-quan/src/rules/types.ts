/** Seat 0 moves first and owns squares 1..5; seat 1 owns squares 7..11. */
export type OAnQuanSeat = 0 | 1;

/** `dir` +1 follows increasing indices: "to the right" for whoever looks at their own row at the bottom. */
export type OAnQuanMove = { cell: number; dir: 1 | -1 };

export type OAnQuanConfig = Record<string, never>;

export type OAnQuanEnd = 'quan_taken' | 'no_stones' | 'move_limit';

export type OAnQuanState = {
  config: OAnQuanConfig;
  /** 12 squares in ring order: 0 = left quan square, 1..5 seat 0, 6 = right quan square, 7..11 seat 1. Counts of dân. */
  cells: number[];
  /** Whether the big quan piece is still on square 0 / square 6. */
  quan: [boolean, boolean];
  /** What each seat has captured. */
  stash: { dan: number; quan: number }[];
  /** Dân each seat borrowed from the other to refill its row. */
  debt: [number, number];
  turn: OAnQuanSeat;
  moveCount: number;
  lastMove: OAnQuanMove | null;
  /** Squares that received a stone on the last move, in order (for the animation). */
  sown: number[];
  /** Squares captured on the last move. */
  taken: number[];
  /** The row of the side to move was refilled automatically before this turn. */
  refill: { seat: OAnQuanSeat; borrowed: number } | null;
  ended: OAnQuanEnd | null;
};
