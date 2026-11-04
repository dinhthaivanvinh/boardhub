import { playMoves } from '@bg/engine/testing';
import { positionHash } from '../src/rules/board';
import { definition } from '../src/rules/definition';
import type { PieceCode, XiangqiSeat, XiangqiState } from '../src/rules/types';

/** Point index: row 0 = Black's back rank, row 9 = Red's back rank. */
export const at = (row: number, col: number): number => row * 9 + col;

export function play(moves: [number, number][]): XiangqiState {
  return playMoves(
    definition,
    {},
    moves.map(([from, to]) => ({ from, to })),
  );
}

/**
 * State from a 10-row diagram of 9 characters. Upper case = Red, lower case = Black,
 * letters K A E H R C P (general, advisor, elephant, horse, chariot, cannon, soldier), '.' = empty.
 */
export function fromDiagram(rows: string[], turn: XiangqiSeat): XiangqiState {
  if (rows.length !== 10 || rows.some((r) => r.length !== 9)) throw new Error('diagram must be 10 rows of 9');
  const board = rows
    .join('')
    .split('')
    .map((ch): PieceCode | null => {
      if (ch === '.') return null;
      const color = ch === ch.toUpperCase() ? 'r' : 'b';
      return `${color}${ch.toUpperCase()}` as PieceCode;
    });
  return {
    config: {},
    board,
    turn,
    moveCount: 0,
    lastMove: null,
    captured: [],
    inCheck: null,
    positions: [positionHash(board, turn)],
    sinceCapture: 0,
    status: 'playing',
    winner: null,
  };
}

export const E = '.........';
