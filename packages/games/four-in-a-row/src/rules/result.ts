import type { GameResult } from '@bg/engine';
import type { FourState } from './types';

export function result(s: FourState): GameResult | null {
  // Win before draw: a last move that fills the board and makes four is a win.
  if (s.winner !== null) return { kind: 'win', winners: [s.winner], reason: 'four_in_row' };
  if (s.moveCount === s.board.length) return { kind: 'draw', reason: 'board_full' };
  return null;
}
