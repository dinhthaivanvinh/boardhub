import { z } from 'zod';
import type { GameResult, MoveCheck, Seat } from '@bg/engine';
import {
  applyToBoard,
  colorOfSeat,
  INITIAL_BOARD,
  isInCheck,
  legalMovesFor,
  positionHash,
  pseudoTargets,
} from './board';
import type { XiangqiConfig, XiangqiMove, XiangqiSeat, XiangqiState, XiangqiStatus } from './types';

export const configSchema = z.strictObject({}) as z.ZodType<XiangqiConfig>;
export const moveSchema = z.strictObject({ from: z.number().int(), to: z.number().int() });

/** 60 moves each without a capture is a draw. */
export const MOVE_LIMIT = 120;

export function setup(config: XiangqiConfig): XiangqiState {
  const board = INITIAL_BOARD.slice();
  return {
    config,
    board,
    turn: 0,
    moveCount: 0,
    lastMove: null,
    captured: [],
    inCheck: null,
    positions: [positionHash(board, 0)],
    sinceCapture: 0,
    status: 'playing',
    winner: null,
  };
}

export function validateMove(s: XiangqiState, seat: Seat, m: XiangqiMove): MoveCheck {
  const inBounds = (sq: number) => sq >= 0 && sq < 90;
  if (!inBounds(m.from) || !inBounds(m.to)) return { ok: false, code: 'xiangqi.out_of_bounds' };
  const piece = s.board[m.from];
  if (!piece) return { ok: false, code: 'xiangqi.no_piece' };
  const color = colorOfSeat(seat);
  if (piece[0] !== color) return { ok: false, code: 'xiangqi.not_your_piece' };
  if (!pseudoTargets(s.board, m.from).includes(m.to)) return { ok: false, code: 'xiangqi.illegal_move' };
  if (isInCheck(applyToBoard(s.board, m), color)) return { ok: false, code: 'xiangqi.self_check' };
  return { ok: true };
}

export function applyMove(s: XiangqiState, seat: Seat, m: XiangqiMove): XiangqiState {
  const captured = s.board[m.to];
  const board = applyToBoard(s.board, m);
  const next: XiangqiSeat = seat === 0 ? 1 : 0;
  const nextColor = colorOfSeat(next);
  const hash = positionHash(board, next);
  const positions = captured ? [hash] : [...s.positions, hash];
  const sinceCapture = captured ? 0 : s.sinceCapture + 1;
  const inCheck = isInCheck(board, nextColor);

  let status: XiangqiStatus = 'playing';
  let winner: XiangqiSeat | null = null;
  if (legalMovesFor(board, nextColor).length === 0) {
    status = inCheck ? 'checkmate' : 'stalemate';
    winner = seat === 0 ? 0 : 1;
  } else if (positions.filter((p) => p === hash).length >= 3) {
    status = 'repetition';
  } else if (sinceCapture >= MOVE_LIMIT) {
    status = 'move_limit';
  }

  return {
    ...s,
    board,
    turn: next,
    moveCount: s.moveCount + 1,
    lastMove: { from: m.from, to: m.to },
    captured: captured ? [...s.captured, captured] : s.captured,
    inCheck: inCheck ? next : null,
    positions,
    sinceCapture,
    status,
    winner,
  };
}

export function legalMoves(s: XiangqiState, seat: Seat): XiangqiMove[] {
  if (s.status !== 'playing') return [];
  return legalMovesFor(s.board, colorOfSeat(seat));
}

export function result(s: XiangqiState): GameResult | null {
  if (s.status === 'playing') return null;
  if (s.winner !== null) return { kind: 'win', winners: [s.winner], reason: s.status };
  return { kind: 'draw', reason: s.status };
}
