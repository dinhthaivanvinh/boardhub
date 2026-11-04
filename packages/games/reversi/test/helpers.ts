import { playMoves } from '@bg/engine/testing';
import { definition } from '../src/rules/definition';
import type { ReversiSeat, ReversiState } from '../src/rules/types';

/** Cell index on the default 8x8 board. */
export const at = (row: number, col: number, size = 8): number => row * size + col;

/** Plays cells in order; whoever is to move plays the next one (handles passes). */
export function play(cells: number[], config: Record<string, unknown> = {}): ReversiState {
  return playMoves(
    definition,
    config,
    cells.map((cell) => ({ cell })),
  );
}

/** 8x8 state from a top-to-bottom diagram: 'B' = Black (seat 0), 'W' = White (seat 1), '.' = empty. */
export function fromDiagram(rows: string[], turn: ReversiSeat): ReversiState {
  const board = rows
    .join('')
    .split('')
    .map((c) => (c === 'B' ? 0 : c === 'W' ? 1 : null));
  if (board.length !== 64) throw new Error('diagram must be 8 rows of 8');
  return {
    config: definition.configSchema.parse({}),
    board,
    turn,
    moveCount: 0,
    lastMove: null,
    flipped: [],
    passed: null,
    over: false,
  };
}

export const EMPTY_ROW = '........';
