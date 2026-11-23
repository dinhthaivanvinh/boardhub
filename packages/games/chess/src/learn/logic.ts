import { fromFen, legalMoves, makeMove, squareOf, START_FEN } from '../rules/board';
import type { ChessMove, Position } from '../rules/types';
import type { OpeningLessonData, PieceLessonData } from './data';

/** "e2e4" -> a move. */
export function parseMove(text: string): ChessMove {
  return { from: squareOf(text.slice(0, 2)), to: squareOf(text.slice(2, 4)) };
}

/** Legal moves of the piece on `from`. */
export const movesFrom = (pos: Position, from: number) => legalMoves(pos).filter((m) => m.from === from);

/** Squares the piece on `from` can go to. */
export const targetsFrom = (pos: Position, from: number) => [
  ...new Set(movesFrom(pos, from).map((m) => m.to)),
];

/** Position after each ply of a line: index 0 is the start, index n the position after n plies. Throws on an illegal move. */
export function positionsOf(lesson: OpeningLessonData): Position[] {
  const out = [fromFen(START_FEN)];
  for (const text of lesson.moves) {
    const pos = out[out.length - 1]!;
    const m = parseMove(text);
    if (!legalMoves(pos).some((x) => x.from === m.from && x.to === m.to)) throw new Error(`illegal ${text}`);
    out.push(makeMove(pos, m));
  }
  return out;
}

/** A piece lesson's positions: the demo one and the challenge one. */
export const demoPosition = (l: PieceLessonData) => fromFen(l.fen);
export const challengePosition = (l: PieceLessonData) => fromFen(l.challenge.fen);

/** How many right squares the child has to find in the "try it" step. */
export const squaresToFind = (targets: number) => Math.min(targets, 4);

/** Up to `max` squares spread over all targets, for the animation. */
export function demoSquares(targets: number[], max = 8): number[] {
  if (targets.length <= max) return targets;
  return Array.from({ length: max }, (_, i) => targets[Math.floor((i * targets.length) / max)]!);
}
