/**
 * Who comes out ahead when pieces are traded on one square. Used by the lessons to judge a move and by the
 * gentlest searching level of the bot. It sees the exchange only, not threats further away.
 */
import { describe, legalMoves, makeMove, other } from './rules/board';
import type { ChessMove, Color, PieceType, Position } from './rules/types';
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

/** What the other side would win on each square if it were its turn now: the squares where that is something. */
export function lossesAt(pos: Position, mine: Color): Map<number, number> {
  const theirs: Position = { ...pos, turn: other(mine), enPassant: pos.turn === mine ? null : pos.enPassant };
  const losses = new Map<number, number>();
  for (const move of legalMoves(theirs)) {
    const victim = describe(theirs, move).captured;
    // A check is not a threatened piece: the board shows it already.
    if (!victim || victim[1] === 'K') continue;
    const gain = netGain(theirs, move);
    if (gain > (losses.get(move.to) ?? 0)) losses.set(move.to, gain);
  }
  return losses;
}

/** My pieces that the other side can win, the biggest loss first. */
export const threatenedSquares = (pos: Position, mine: Color): number[] =>
  [...lossesAt(pos, mine)].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([square]) => square);

/** Points won by a move, less the most the answer can win back on any square. */
export function swing(pos: Position, move: ChessMove): number {
  return taken(pos, move) - Math.max(0, ...lossesAt(makeMove(pos, move), pos.turn).values());
}
