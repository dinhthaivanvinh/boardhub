/**
 * Who comes out ahead when pieces are traded on one square. Used by the lessons to judge a move and by the
 * gentlest searching level of the bot. It sees the exchange only, not threats further away.
 */
import { describe, legalMoves, makeMove } from './rules/board';
import type { ChessMove, PieceType, Position } from './rules/types';
import { PIECE_VALUE } from './learn/capture';

/** The points a move takes off the board. */
const taken = (pos: Position, move: ChessMove): number => {
  const piece = describe(pos, move).captured;
  return piece ? PIECE_VALUE[piece[1] as PieceType] : 0;
};

/**
 * The points the side to move can win by trading on `square`, counting the whole exchange: each side takes back
 * only while that pays.
 */
function exchangeGain(pos: Position, square: number): number {
  let best = 0;
  for (const m of legalMoves(pos)) {
    if (m.to !== square) continue;
    best = Math.max(best, taken(pos, m) - exchangeGain(makeMove(pos, m), square));
  }
  return best;
}

/** The points a move comes out ahead after the whole exchange on its square (negative: it loses). */
export const netGain = (pos: Position, move: ChessMove): number =>
  taken(pos, move) - exchangeGain(makeMove(pos, move), move.to);

/** Whether the piece that just moved is safe: the other side gains no more on that square than the move took. */
export const movedPieceIsSafe = (pos: Position, move: ChessMove): boolean => netGain(pos, move) >= 0;

/** The capture that leaves the side to move furthest ahead after the whole exchange, or null. */
export function winsMaterial(pos: Position): ChessMove | null {
  let best: ChessMove | null = null;
  let most = 0;
  for (const m of legalMoves(pos)) {
    if (taken(pos, m) === 0) continue;
    const gain = netGain(pos, m);
    if (gain > most) {
      best = m;
      most = gain;
    }
  }
  return best;
}
