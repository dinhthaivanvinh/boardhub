import type { GameResult } from '@bg/engine';
import type { CaroState } from './types';

export function result(s: CaroState): GameResult | null {
  // Win is checked before draw: a last move that fills the board and makes a line is a win.
  if (s.winner !== null) return { kind: 'win', winners: [s.winner], reason: 'five_in_row' };
  if (s.moveCount === s.board.length) return { kind: 'draw', reason: 'board_full' };
  return null;
}
