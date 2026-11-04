import { z } from 'zod';
import type { MoveCheck, Seat } from '@bg/engine';
import { dropRow, findWinLine } from './board';
import type { FourMove, FourSeat, FourState } from './types';

export const moveSchema = z.strictObject({ col: z.number().int() });

export function validateMove(s: FourState, _seat: Seat, m: FourMove): MoveCheck {
  if (m.col < 0 || m.col >= s.config.columns) return { ok: false, code: 'four-in-a-row.out_of_bounds' };
  if (dropRow(s.board, s.config, m.col) < 0) return { ok: false, code: 'four-in-a-row.column_full' };
  return { ok: true };
}

export function applyMove(s: FourState, seat: Seat, m: FourMove): FourState {
  const piece: FourSeat = seat === 0 ? 0 : 1;
  const cell = dropRow(s.board, s.config, m.col) * s.config.columns + m.col;
  const board = s.board.slice();
  board[cell] = piece;
  const winLine = findWinLine(board, s.config, cell, piece);
  return {
    ...s,
    board,
    turn: piece === 0 ? 1 : 0,
    moveCount: s.moveCount + 1,
    lastMove: cell,
    winner: winLine ? piece : null,
    winLine,
  };
}

/** Columns that are not full, left to right. */
export function legalMoves(s: FourState): FourMove[] {
  const moves: FourMove[] = [];
  for (let col = 0; col < s.config.columns; col++) {
    if (s.board[col] === null) moves.push({ col });
  }
  return moves;
}
