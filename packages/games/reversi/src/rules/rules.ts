import { z } from 'zod';
import type { GameResult, MoveCheck, Seat } from '@bg/engine';
import { countDiscs, flipsFor, legalCells } from './board';
import type { ReversiConfig, ReversiMove, ReversiSeat, ReversiState } from './types';

export const moveSchema = z.strictObject({ cell: z.number().int() });

export function setup(config: ReversiConfig): ReversiState {
  const { size } = config;
  const board: (ReversiSeat | null)[] = Array.from({ length: size * size }, () => null);
  const m = size / 2;
  board[(m - 1) * size + (m - 1)] = 1;
  board[m * size + m] = 1;
  board[(m - 1) * size + m] = 0;
  board[m * size + (m - 1)] = 0;
  return { config, board, turn: 0, moveCount: 0, lastMove: null, flipped: [], passed: null, over: false };
}

export function validateMove(s: ReversiState, seat: Seat, m: ReversiMove): MoveCheck {
  if (m.cell < 0 || m.cell >= s.board.length) return { ok: false, code: 'reversi.out_of_bounds' };
  if (s.board[m.cell] !== null) return { ok: false, code: 'reversi.cell_occupied' };
  if (flipsFor(s.board, s.config.size, m.cell, seat === 0 ? 0 : 1).length === 0) {
    return { ok: false, code: 'reversi.no_flips' };
  }
  return { ok: true };
}

export function applyMove(s: ReversiState, seat: Seat, m: ReversiMove): ReversiState {
  const piece: ReversiSeat = seat === 0 ? 0 : 1;
  const other: ReversiSeat = piece === 0 ? 1 : 0;
  const { size } = s.config;
  const flipped = flipsFor(s.board, size, m.cell, piece);
  const board = s.board.slice();
  board[m.cell] = piece;
  for (const cell of flipped) board[cell] = piece;

  // Turn order with automatic passes: the other side moves if it can, else we move again, else the game is over.
  let turn: ReversiSeat = other;
  let passed: ReversiSeat | null = null;
  let over = false;
  if (legalCells(board, size, other).length === 0) {
    if (legalCells(board, size, piece).length > 0) {
      turn = piece;
      passed = other;
    } else {
      over = true;
    }
  }
  return { ...s, board, turn, moveCount: s.moveCount + 1, lastMove: m.cell, flipped, passed, over };
}

export function legalMoves(s: ReversiState, seat: Seat): ReversiMove[] {
  if (s.over) return [];
  return legalCells(s.board, s.config.size, seat === 0 ? 0 : 1).map((cell) => ({ cell }));
}

export function result(s: ReversiState): GameResult | null {
  if (!s.over) return null;
  const [black, white] = countDiscs(s.board);
  if (black === white) return { kind: 'draw', reason: 'equal_discs' };
  return { kind: 'win', winners: [black > white ? 0 : 1], reason: 'more_discs' };
}
