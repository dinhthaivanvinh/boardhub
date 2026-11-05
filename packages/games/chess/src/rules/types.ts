export type Color = 'w' | 'b';
export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
/** `w` = White (seat 0), `b` = Black (seat 1), then the piece type. */
export type Piece = `${Color}${PieceType}`;
export type Promotion = 'Q' | 'R' | 'B' | 'N';

/** Seat 0 plays White and moves first. */
export type ChessSeat = 0 | 1;

export type ChessMove = { from: number; to: number; promotion?: Promotion | undefined };

export type ChessStatus =
  'playing' | 'checkmate' | 'stalemate' | 'repetition' | 'fifty_moves' | 'insufficient';

export type ChessConfig = Record<string, never>;

export type LastMove = {
  from: number;
  to: number;
  promotion: Promotion | null;
  piece: Piece;
  captured: Piece | null;
  castle: 'K' | 'Q' | null;
  enPassant: boolean;
};

/** The part of the state the move generator needs (also what FEN describes). */
export type Position = {
  /** 64 squares, index = row * 8 + col; row 0 is rank 8, col 0 is file a. */
  board: (Piece | null)[];
  turn: Color;
  /** Castling rights as in FEN: any of "KQkq", "" when none are left. */
  castling: string;
  /** Square a pawn may capture en passant on, if any. */
  enPassant: number | null;
};

export type ChessState = Omit<Position, 'turn'> & {
  config: ChessConfig;
  turn: ChessSeat;
  /** Plies since the last pawn move or capture (fifty-move rule). */
  halfmove: number;
  fullmove: number;
  moveCount: number;
  lastMove: LastMove | null;
  /** Position hashes since the last irreversible move, including the current one (repetition). */
  positions: number[];
  /** The side to move, if it is in check. */
  inCheck: ChessSeat | null;
  status: ChessStatus;
  winner: ChessSeat | null;
};
