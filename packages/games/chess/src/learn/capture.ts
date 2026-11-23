import { describe as describeMove, legalMoves, makeMove, squareOf } from '../rules/board';
import type { ChessMove, PieceType, Position } from '../rules/types';

/** The id of the capturing lesson ("Ăn quân và bảo vệ"). */
export const CAPTURE_LESSON_ID = 'capture';

export type TakeRound = { fen: string };
export type AttackedRound = { fen: string };
export type SafeRound = { fen: string; from: string; to: string };
export type ValueRound = { left: PieceType; right: PieceType };

/** White to move: take any black piece. Both kings are far from the action and never in check. */
export const TAKE_ROUNDS: TakeRound[] = [
  { fen: 'k7/8/8/8/3R2p1/8/8/K7 w - -' }, // rook along a rank
  { fen: 'k7/8/7p/8/8/8/8/K1B5 w - -' }, // bishop along a diagonal
  { fen: 'k7/8/5p2/8/4N3/8/8/K7 w - -' }, // knight jumps
  { fen: 'k7/8/8/3p4/4P3/8/8/K7 w - -' }, // pawn takes sideways
  { fen: 'k7/6p1/1p6/8/3Q4/8/8/K7 w - -' }, // queen: two to choose from
];

/** Black to move: find the white piece in danger. Another white piece is always safe. */
export const ATTACKED_ROUNDS: AttackedRound[] = [
  { fen: 'k3r3/8/8/8/4N3/8/P7/K7 b - -' }, // rook on the file
  { fen: 'k7/8/4b3/8/8/1R6/7P/K7 b - -' }, // bishop on the diagonal
  { fen: 'k7/8/5n2/8/6Q1/8/P7/K7 b - -' }, // knight jumps
  { fen: 'k7/8/8/3p4/2B5/8/P7/K7 b - -' }, // pawn takes sideways
  { fen: 'k7/8/8/8/1q2N1R1/8/P7/7K b - -' }, // queen along a rank
];

/** White could take; should it? `safe` is checked against the engine in a test. */
export const SAFE_ROUNDS: SafeRound[] = [
  { fen: '7k/8/8/3p4/8/4N3/8/K7 w - -', from: 'e3', to: 'd5' }, // nobody guards the pawn
  { fen: '7k/8/8/3p4/R3p3/8/8/K7 w - -', from: 'a4', to: 'e4' }, // the pawn on d5 guards it
  { fen: '6k1/2p5/1p6/8/3Q4/8/8/K7 w - -', from: 'd4', to: 'b6' }, // queen for a pawn
  { fen: '7k/8/5n2/8/8/8/1B6/K7 w - -', from: 'b2', to: 'f6' }, // nobody guards the knight
  { fen: '7k/6p1/5p2/8/4N3/8/8/K7 w - -', from: 'e4', to: 'f6' }, // the pawn on g7 guards it
  { fen: '7k/8/8/3p4/4P3/8/8/K7 w - -', from: 'e4', to: 'd5' }, // nobody guards the pawn
];

/** Which piece is worth more: no ties, so there is one right answer. */
export const VALUE_ROUNDS: ValueRound[] = [
  { left: 'P', right: 'R' },
  { left: 'Q', right: 'R' },
  { left: 'N', right: 'P' },
  { left: 'R', right: 'B' },
  { left: 'Q', right: 'N' },
];

/** The points a child can count with: pawn 1, knight and bishop 3, rook 5, queen 9. */
export const PIECE_VALUE: Record<PieceType, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

/** Legal moves that take a piece. */
export const captures = (pos: Position): ChessMove[] =>
  legalMoves(pos).filter((m) => describeMove(pos, m).captured !== null);

/** Squares of the side-to-move's opponent's pieces that the side to move can take. */
export const capturable = (pos: Position): number[] => [...new Set(captures(pos).map((m) => m.to))];

/** Squares of the pieces that can take something: the attackers. */
export const attackers = (pos: Position): number[] => [...new Set(captures(pos).map((m) => m.from))];

/** After White takes, can Black take back on the same square? Then the capture is not free. */
export function recapturers(pos: Position, move: ChessMove): number[] {
  const after = makeMove(pos, move);
  return legalMoves(after)
    .filter((m) => m.to === move.to)
    .map((m) => m.from);
}

export const isSafeCapture = (pos: Position, move: ChessMove) => recapturers(pos, move).length === 0;

export const toMove = (round: SafeRound): ChessMove => ({
  from: squareOf(round.from),
  to: squareOf(round.to),
});
