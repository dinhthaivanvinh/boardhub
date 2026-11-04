import { playMoves } from '@bg/engine/testing';
import { definition } from '../src/rules/definition';
import type { FourSeat, FourState } from '../src/rules/types';

const DEFAULT = definition.configSchema.parse({});

/** Cell index on the default 7-column board. row 0 = top. */
export const at = (row: number, col: number, columns = 7): number => row * columns + col;

/** Drops pieces in these columns, players alternating (Yellow first). */
export function drops(cols: number[], config: Record<string, unknown> = {}): FourState {
  return playMoves(
    definition,
    config,
    cols.map((col) => ({ col })),
  );
}

/**
 * State from a top-to-bottom diagram on the default 7x6 board: 'Y' = seat 0, 'R' = seat 1, '.' = empty.
 * Gravity is not checked, so any position can be described.
 */
export function fromDiagram(rows: string[], turn: FourSeat): FourState {
  const board = rows
    .join('')
    .split('')
    .map((c) => (c === 'Y' ? 0 : c === 'R' ? 1 : null));
  if (board.length !== 42) throw new Error('diagram must be 6 rows of 7');
  return {
    config: DEFAULT,
    board,
    turn,
    moveCount: board.filter((c) => c !== null).length,
    lastMove: null,
    winner: null,
    winLine: null,
  };
}

/** Mirror a diagram left-right. */
export const mirror = (rows: string[]) => rows.map((r) => r.split('').reverse().join(''));

/** Pattern with no 3 in a row in any direction: value = (floor(col / 2) + row) % 2. */
export function noWinPattern(columns: number, rows: number): FourSeat[] {
  return Array.from(
    { length: columns * rows },
    (_, i) => ((Math.floor((i % columns) / 2) + Math.floor(i / columns)) % 2) as FourSeat,
  );
}
