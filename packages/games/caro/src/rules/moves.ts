import { z } from 'zod';
import type { MoveCheck, Seat } from '@bg/engine';
import type { CaroMove, CaroSeat, CaroState } from './types';
import { findWinLine } from './win';

export const moveSchema = z.strictObject({ cell: z.number().int() });

export function validateMove(s: CaroState, _seat: Seat, m: CaroMove): MoveCheck {
  if (m.cell < 0 || m.cell >= s.board.length) return { ok: false, code: 'caro.out_of_bounds' };
  if (s.board[m.cell] !== null) return { ok: false, code: 'caro.cell_occupied' };
  return { ok: true };
}

export function applyMove(s: CaroState, seat: Seat, m: CaroMove): CaroState {
  const piece: CaroSeat = seat === 0 ? 0 : 1;
  const board = s.board.slice();
  board[m.cell] = piece;
  const winLine = findWinLine(board, s.config, m.cell, piece);
  return {
    ...s,
    board,
    turn: piece === 0 ? 1 : 0,
    moveCount: s.moveCount + 1,
    lastMove: m.cell,
    winner: winLine ? piece : null,
    winLine,
  };
}

export function legalMoves(s: CaroState): CaroMove[] {
  const moves: CaroMove[] = [];
  s.board.forEach((v, cell) => {
    if (v === null) moves.push({ cell });
  });
  return moves;
}
