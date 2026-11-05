import { z } from 'zod';
import type { GameResult, MoveCheck, Seat } from '@bg/engine';
import { countPieces, NEIGHBOURS, openingMoves, other, plainMoves, playOnBoard, POINTS } from './board';
import type { CoGanhConfig, CoGanhMove, CoGanhSeat, CoGanhState } from './types';

export const configSchema = z.strictObject({}) as z.ZodType<CoGanhConfig>;
export const moveSchema = z.strictObject({ from: z.number().int(), to: z.number().int() });

/** 60 moves each without a capture is a draw. */
export const MOVE_LIMIT = 120;

const R = 0;
const B = 1;
const _ = null;
// prettier-ignore
const START: (CoGanhSeat | null)[] = [
  B, B, B, B, B,
  B, _, _, _, B,
  R, _, _, _, B,
  R, _, _, _, R,
  R, R, R, R, R,
];

export function setup(config: CoGanhConfig): CoGanhState {
  return {
    config,
    board: START.slice(),
    turn: 0,
    moveCount: 0,
    lastMove: null,
    carried: [],
    surrounded: [],
    forced: null,
    sinceCapture: 0,
    status: 'playing',
    winner: null,
  };
}

const seatPiece = (seat: Seat): CoGanhSeat => (seat === 0 ? 0 : 1);

export function validateMove(s: CoGanhState, seat: Seat, m: CoGanhMove): MoveCheck {
  const inside = (p: number) => p >= 0 && p < POINTS;
  if (!inside(m.from) || !inside(m.to)) return { ok: false, code: 'co-ganh.out_of_bounds' };
  const piece = s.board[m.from];
  if (piece === null || piece === undefined) return { ok: false, code: 'co-ganh.no_piece' };
  if (piece !== seatPiece(seat)) return { ok: false, code: 'co-ganh.not_your_piece' };
  if (!NEIGHBOURS[m.from]!.includes(m.to)) return { ok: false, code: 'co-ganh.not_adjacent' };
  if (s.board[m.to] !== null) return { ok: false, code: 'co-ganh.occupied' };
  if (
    s.forced !== null &&
    !openingMoves(s.board, piece, s.forced).some((o) => o.from === m.from && o.to === m.to)
  ) {
    return { ok: false, code: 'co-ganh.must_open' };
  }
  return { ok: true };
}

export function applyMove(s: CoGanhState, seat: Seat, m: CoGanhMove): CoGanhState {
  const piece = seatPiece(seat);
  const { board, carried, surrounded } = playOnBoard(s.board, m);
  const next = other(piece);
  const captured = carried.length + surrounded.length > 0;
  const sinceCapture = captured ? 0 : s.sinceCapture + 1;
  // "Mở": the point we just left is forced on the opponent if they can carry by moving into it.
  const forced = openingMoves(board, next, m.from).length > 0 ? m.from : null;

  let status: CoGanhState['status'] = 'playing';
  let winner: CoGanhSeat | null = null;
  if (countPieces(board)[next] === 0) {
    status = 'all_taken';
    winner = piece;
  } else if (sinceCapture >= MOVE_LIMIT) {
    status = 'move_limit';
  }
  return {
    ...s,
    board,
    turn: next,
    moveCount: s.moveCount + 1,
    lastMove: m,
    carried,
    surrounded,
    forced: status === 'playing' ? forced : null,
    sinceCapture,
    status,
    winner,
  };
}

export function legalMoves(s: CoGanhState, seat: Seat): CoGanhMove[] {
  if (s.status !== 'playing') return [];
  const piece = seatPiece(seat);
  return s.forced !== null ? openingMoves(s.board, piece, s.forced) : plainMoves(s.board, piece);
}

export function result(s: CoGanhState): GameResult | null {
  if (s.status === 'playing') return null;
  if (s.status === 'move_limit') return { kind: 'draw', reason: 'move_limit' };
  return { kind: 'win', winners: [s.winner ?? 0], reason: 'all_taken' };
}
