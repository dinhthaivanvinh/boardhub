import { colOf, describe, kingSquare, legalMoves, makeMove, rowOf } from '../rules/board';
import type { ChessMove, PieceType, Position } from '../rules/types';
import { PIECE_VALUE } from './capture';
import { isCheckmate, isStalemate, matingMoves } from './checkmate';

/** "Chiếu hết đến cùng": playing on against a lone king until it is mated. */
export const BASIC_MATES_LESSON_ID = 'basic-mates';

export type MateDrillId = 'rooks' | 'queen' | 'rook';

export type MateDrill = {
  id: MateDrillId;
  /** White to move; Black has only the king. */
  fen: string;
  /** After this many white moves without mate the drill is offered again. */
  limit: number;
};

/** The two drills of the lesson. */
export const MATE_DRILLS: readonly MateDrill[] = [
  { id: 'rooks', fen: '8/8/8/4k3/8/8/8/R3K2R w - -', limit: 25 },
  { id: 'queen', fen: '8/8/8/4k3/8/8/8/3QK3 w - -', limit: 30 },
];

/** One rook is much harder: offered after the lesson, never needed to finish it. */
export const ROOK_CHALLENGE: MateDrill = { id: 'rook', fen: '8/8/8/4k3/8/8/8/R3K3 w - -', limit: 40 };

/** Squares between two squares, counted as king steps. */
const kingSteps = (a: number, b: number) =>
  Math.max(Math.abs(rowOf(a) - rowOf(b)), Math.abs(colOf(a) - colOf(b)));

/** Twice the distance from the middle of the board: 2 (centre) to 14 (corner). */
const fromCentre = (s: number) => Math.abs(2 * rowOf(s) - 7) + Math.abs(2 * colOf(s) - 7);

const onEdge = (s: number) => rowOf(s) === 0 || rowOf(s) === 7 || colOf(s) === 0 || colOf(s) === 7;

/**
 * The lone black king's move, the same every time for a position: take a piece nobody guards (the most valuable
 * one); otherwise do not walk into a mate in one, and go where there is the most room, near the middle. It looks
 * no further, so it is not a perfect defence, on purpose.
 */
export function defenderMove(pos: Position): ChessMove | null {
  const moves = legalMoves(pos);
  const score = (m: ChessMove) => {
    const victim = describe(pos, m).captured;
    if (victim) return 10_000 + PIECE_VALUE[victim[1] as PieceType];
    // Room: the squares the king could step to from there, as the white pieces stand now.
    const next = makeMove(pos, m);
    const room = legalMoves({ ...next, turn: 'b' }).length;
    const walksIntoMate = matingMoves(next).length > 0;
    return (walksIntoMate ? -10_000 : 0) + room * 10 - fromCentre(m.to);
  };
  let best: ChessMove | null = null;
  let bestScore = -Infinity;
  for (const m of moves) {
    const s = score(m);
    if (s > bestScore) {
      best = m;
      bestScore = s;
    }
  }
  return best;
}

export type MateStep =
  | { kind: 'mate' }
  /** The black king has no move and is not in check: a draw the child must take back. */
  | { kind: 'stalemate' }
  /** The black king takes a piece: shown, then taken back. */
  | { kind: 'lost'; reply: ChessMove }
  | { kind: 'goOn'; reply: ChessMove };

/** What White's move leads to. */
export function judgeMateMove(pos: Position, move: ChessMove): MateStep {
  const next = makeMove(pos, move);
  if (isCheckmate(next)) return { kind: 'mate' };
  if (isStalemate(next)) return { kind: 'stalemate' };
  const reply = defenderMove(next)!;
  if (describe(next, reply).captured) return { kind: 'lost', reply };
  return { kind: 'goOn', reply };
}

export type MateTip =
  'rooks' | 'queenCage' | 'queenKing' | 'queenMate' | 'rookCut' | 'rookKing' | 'rookCheck';

/** The advice in words for a position with no mate in one: the next part of the method. */
export function mateTip(drill: MateDrillId, pos: Position): MateTip {
  if (drill === 'rooks') return 'rooks';
  const black = kingSquare(pos.board, 'b');
  const white = kingSquare(pos.board, 'w');
  if (drill === 'queen') {
    if (!onEdge(black)) return 'queenCage';
    return kingSteps(black, white) > 2 ? 'queenKing' : 'queenMate';
  }
  if (!onEdge(black)) return 'rookCut';
  // "Face to face": two squares apart on one line.
  const rows = Math.abs(rowOf(black) - rowOf(white));
  const cols = Math.abs(colOf(black) - colOf(white));
  return (rows === 2 && cols === 0) || (rows === 0 && cols === 2) ? 'rookCheck' : 'rookKing';
}

/** The hint: a mate in one when there is one, otherwise only words. */
export const mateHint = (drill: MateDrillId, pos: Position): { move: ChessMove | null; tip: MateTip } => ({
  move: matingMoves(pos)[0] ?? null,
  tip: mateTip(drill, pos),
});
