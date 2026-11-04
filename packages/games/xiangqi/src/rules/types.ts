export type Color = 'r' | 'b';
export type PieceType = 'K' | 'A' | 'E' | 'H' | 'R' | 'C' | 'P';
/** `r` = Red (seat 0), `b` = Black (seat 1), then the piece type. */
export type PieceCode = `${Color}${PieceType}`;

/** Seat 0 plays Red and moves first, seat 1 plays Black. */
export type XiangqiSeat = 0 | 1;

export type XiangqiMove = { from: number; to: number };

export type XiangqiStatus = 'playing' | 'checkmate' | 'stalemate' | 'repetition' | 'move_limit';

export type XiangqiConfig = Record<string, never>;

export type XiangqiState = {
  config: XiangqiConfig;
  /** 90 points, index = row * 9 + col; row 0 is Black's back rank. */
  board: (PieceCode | null)[];
  turn: XiangqiSeat;
  moveCount: number;
  lastMove: XiangqiMove | null;
  captured: PieceCode[];
  /** The side to move, if it is in check. */
  inCheck: XiangqiSeat | null;
  /** Position hashes since the last capture, including the current one (for repetition). */
  positions: number[];
  /** Plies since the last capture. */
  sinceCapture: number;
  status: XiangqiStatus;
  winner: XiangqiSeat | null;
};
