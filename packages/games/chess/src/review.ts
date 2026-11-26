/**
 * Going over a finished game with a child: which of their moves are worth another look. It checks only what a
 * beginner can learn from, one reply ahead: a mate in one missed or allowed, a stalemate given when ahead, a
 * piece left to be taken, a piece that was there to be won. It does not see plans or tactics further away.
 */
import { describe, legalMoves, makeMove, other } from './rules/board';
import { positionOf } from './rules/rules';
import type { ChessMove, ChessState, PieceType, Position } from './rules/types';
import { coachMove } from './coach';
import { lossesAt, netGain, swing, winsMaterial } from './exchange';
import { PIECE_VALUE } from './learn/capture';
import { isCheckmate, isStalemate, matingMoves } from './learn/checkmate';

/** A mistake is at least this many points: a knight or a bishop. Losing a single pawn is not pointed out. */
export const MISTAKE_POINTS = PIECE_VALUE.N;
/** The most moments a review shows: a child learns from one or two, not from a list. */
export const MAX_MOMENTS = 2;

export type MistakeKind = 'allowedMate' | 'stalemate' | 'missedMate' | 'hung' | 'missedFree';

export type Mistake = {
  kind: MistakeKind;
  /** What the child played. */
  played: ChessMove;
  /** A better move, found by the engine. */
  better: ChessMove;
  /** The answer that shows the problem (the mate, or the capture of the piece left behind). */
  reply?: ChessMove;
  /** The square the words are about: the piece that can be lost, or the one that could have been taken. */
  square?: number;
  /** How much it matters, for choosing which moments to show. */
  weight: number;
};

const worth = (pos: Position, move: ChessMove): number => {
  const piece = describe(pos, move).captured;
  return piece ? PIECE_VALUE[piece[1] as PieceType] : 0;
};

/** A move that neither lets the other side mate at once nor leaves it with no move while not in check. */
function sound(pos: Position, move: ChessMove): boolean {
  const next = makeMove(pos, move);
  return isCheckmate(next) || (!isStalemate(next) && matingMoves(next).length === 0);
}

/** The best material result among the sound moves, and a move that gets it. */
function bestSwing(pos: Position): { value: number; move: ChessMove } | null {
  let best: { value: number; move: ChessMove } | null = null;
  for (const move of legalMoves(pos)) {
    const value = swing(pos, move);
    if ((!best || value > best.value) && sound(pos, move)) best = { value, move };
  }
  return best;
}

/** Material of the side to move less the other side's. */
const lead = (pos: Position): number =>
  pos.board.reduce(
    (sum, p) => (p ? sum + (p[0] === pos.turn ? 1 : -1) * PIECE_VALUE[p[1] as PieceType] : sum),
    0,
  );

/** What was wrong with a move played from `state`, or null when there is nothing a beginner should look at. */
export function judgePlayed(state: ChessState, played: ChessMove): Mistake | null {
  const pos = positionOf(state);
  const next = makeMove(pos, played);
  if (isCheckmate(next)) return null;

  const mates = matingMoves(pos);
  const reply = matingMoves(next)[0];
  if (reply) {
    const better = mates[0] ?? legalMoves(pos).find((m) => sound(pos, m));
    // With no way out there was nothing to learn from this move.
    if (better) return { kind: 'allowedMate', played, better, reply, weight: 100 };
    return null;
  }
  if (isStalemate(next) && lead(pos) >= MISTAKE_POINTS) {
    const better = mates[0] ?? coachMove(state)?.move;
    if (better) return { kind: 'stalemate', played, better, weight: 95 };
  }
  if (mates[0]) return { kind: 'missedMate', played, better: mates[0], weight: 90 };

  const losses = lossesAt(next, pos.turn);
  const lost = Math.max(0, ...losses.values());
  const free = legalMoves(pos).some((m) => worth(pos, m) > 0 && netGain(pos, m) >= MISTAKE_POINTS);
  // Neither a piece left to be taken nor one to be won: no need to try every move.
  if (lost < MISTAKE_POINTS && !free) return null;
  const mine = worth(pos, played) - lost;
  const best = bestSwing(pos);
  if (!best || best.value - mine < MISTAKE_POINTS) return null;
  const weight = best.value - mine;

  if (lost >= MISTAKE_POINTS) {
    const square = [...losses].sort((a, b) => b[1] - a[1])[0]![0];
    const theirs: Position = { ...next, turn: other(pos.turn) };
    const take = legalMoves(theirs)
      .filter((m) => m.to === square)
      .sort((a, b) => netGain(theirs, b) - netGain(theirs, a))[0];
    return {
      kind: 'hung',
      played,
      better: best.move,
      ...(take ? { reply: take } : {}),
      square,
      weight,
    };
  }
  const target = winsMaterial(pos);
  if (!target || netGain(pos, target) < MISTAKE_POINTS) return null;
  const better = sound(pos, target) ? target : best.move;
  return { kind: 'missedFree', played, better, square: better.to, weight };
}

/** Whether a new try at the same position puts the mistake right. */
export function putsRight(state: ChessState, mistake: Mistake, move: ChessMove): boolean {
  const pos = positionOf(state);
  if (isCheckmate(makeMove(pos, move))) return true;
  if (mistake.kind === 'missedMate') return false;
  if (!sound(pos, move)) return false;
  // Avoiding the mate or the draw is the lesson there.
  if (mistake.kind === 'allowedMate' || mistake.kind === 'stalemate') return true;
  const best = bestSwing(pos);
  return best !== null && best.value - swing(pos, move) < MISTAKE_POINTS;
}

export type Moment = Mistake & {
  /** The position the move was played from. */
  state: ChessState;
  /** The move's number in the game, from 1 (as a player counts: one for each pair). */
  moveNumber: number;
};

/** The moments to show from all the mistakes found: the weightiest ones, in the order they happened. */
export const pickMoments = (found: readonly Moment[], max = MAX_MOMENTS): Moment[] => {
  const order = new Map(found.map((m, i) => [m, i]));
  return [...found]
    .sort((a, b) => b.weight - a.weight || order.get(a)! - order.get(b)!)
    .slice(0, max)
    .sort((a, b) => order.get(a)! - order.get(b)!);
};
