import { playMoves } from '@bg/engine/testing';
import { definition } from '../src/rules/definition';
import type { CoGanhSeat, CoGanhState } from '../src/rules/types';

/** Point index: row 0 = Blue's side (top), row 4 = Red's side. */
export const at = (row: number, col: number): number => row * 5 + col;

export function play(moves: [number, number][]): CoGanhState {
  return playMoves(
    definition,
    {},
    moves.map(([from, to]) => ({ from, to })),
  );
}

/** State from 5 rows of 5 characters: R = Red (seat 0), B = Blue (seat 1), '.' = empty. */
export function fromDiagram(rows: string[], turn: CoGanhSeat, forced: number | null = null): CoGanhState {
  if (rows.length !== 5 || rows.some((r) => r.length !== 5)) throw new Error('diagram must be 5 rows of 5');
  const board = rows
    .join('')
    .split('')
    .map((ch): CoGanhSeat | null => (ch === 'R' ? 0 : ch === 'B' ? 1 : null));
  return {
    config: {},
    board,
    turn,
    moveCount: 0,
    lastMove: null,
    carried: [],
    surrounded: [],
    forced,
    sinceCapture: 0,
    status: 'playing',
    winner: null,
  };
}

export const show = (s: CoGanhState): string[] =>
  Array.from({ length: 5 }, (_, r) =>
    s.board
      .slice(r * 5, r * 5 + 5)
      .map((v) => (v === 0 ? 'R' : v === 1 ? 'B' : '.'))
      .join(''),
  );
