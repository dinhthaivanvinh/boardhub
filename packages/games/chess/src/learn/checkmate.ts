import { describe as describeMove, inCheck, legalMoves, makeMove } from '../rules/board';
import type { ChessMove, Position } from '../rules/types';

/** The id of the checkmate lesson ("Bắt vua"). */
export const CHECKMATE_LESSON_ID = 'checkmate';

/** How a checked king is saved: it runs away, a piece blocks the line, or the attacker is captured. */
export type RescueKind = 'run' | 'block' | 'capture';

export type CheckRound = { fen: string; attacker: string };
export type EscapeRound = { fen: string; kind: RescueKind };
export type JudgeRound = { fen: string; mate: boolean };
export type MateRound = { fen: string };

// All check positions have White to move and White's king in check: the child defends their own king.
export const CHECK_ROUNDS: CheckRound[] = [
  { fen: '4r2k/8/8/8/8/8/8/4K3 w - -', attacker: 'e8' }, // rook
  { fen: '7k/8/8/8/1b6/8/8/4K3 w - -', attacker: 'b4' }, // bishop
  { fen: '7k/8/8/8/8/3n4/8/4K3 w - -', attacker: 'd3' }, // knight
  { fen: '7k/8/8/8/7q/8/8/4K3 w - -', attacker: 'h4' }, // queen
  { fen: '7k/8/8/3p4/4K3/8/8/8 w - -', attacker: 'd5' }, // pawn
];

export const ESCAPE_ROUNDS: EscapeRound[] = [
  { fen: '4r2k/8/8/8/8/8/8/4K3 w - -', kind: 'run' },
  { fen: '4r2k/8/3N4/8/8/8/8/4K3 w - -', kind: 'capture' },
  { fen: '4r2k/8/8/8/2B5/8/8/4K3 w - -', kind: 'block' },
];

/** `mate` is what the engine says; a test keeps the two in step. */
export const JUDGE_ROUNDS: JudgeRound[] = [
  { fen: '4r2k/8/8/8/8/8/8/4K3 w - -', mate: false },
  { fen: '6k1/8/8/8/8/8/5PPP/4r1K1 w - -', mate: true },
  { fen: '4r2k/8/3N4/8/8/8/8/4K3 w - -', mate: false },
  { fen: '7k/8/8/8/8/8/r7/1r2K3 w - -', mate: true },
  { fen: '8/8/8/8/8/6k1/6q1/7K w - -', mate: true },
  { fen: '4r2k/8/8/8/2B5/8/8/4K3 w - -', mate: false },
];

/** White to move and mates in one: queen and rook, alternating. */
export const MATE_ROUNDS: MateRound[] = [
  { fen: '7k/6pp/8/8/8/8/8/Q5K1 w - -' },
  { fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - -' },
  { fen: '7k/5K2/8/8/8/8/8/6Q1 w - -' },
  { fen: '7k/8/6K1/8/8/8/8/R7 w - -' },
  { fen: '4k3/8/4K3/8/8/8/8/Q7 w - -' },
  { fen: '7k/R7/8/8/8/8/8/1R4K1 w - -' },
];

/** No legal move and the king is attacked. */
export const isCheckmate = (pos: Position) => legalMoves(pos).length === 0 && inCheck(pos.board, pos.turn);
/** No legal move but the king is safe: a draw, not a win. */
export const isStalemate = (pos: Position) => legalMoves(pos).length === 0 && !inCheck(pos.board, pos.turn);

/** Every move that gives checkmate: any of them is a right answer, not only the one the lesson had in mind. */
export const matingMoves = (pos: Position): ChessMove[] =>
  legalMoves(pos).filter((m) => isCheckmate(makeMove(pos, m)));

/** Taking the attacker counts as "capture" even when the king does it. */
export function rescueKind(pos: Position, move: ChessMove): RescueKind {
  const { piece, captured } = describeMove(pos, move);
  if (captured) return 'capture';
  return piece[1] === 'K' ? 'run' : 'block';
}

/** The reply shown when a move is not mate: the defender's king-first move, so the child sees it escape. */
export function escapeReply(pos: Position): ChessMove | null {
  const moves = legalMoves(pos);
  return moves.find((m) => pos.board[m.from]?.[1] === 'K') ?? moves[0] ?? null;
}
