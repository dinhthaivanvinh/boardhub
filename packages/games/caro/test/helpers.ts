import { playMoves } from '@bg/engine/testing';
import { definition } from '../src/rules/definition';
import type { CaroMove, CaroState } from '../src/rules/types';

/** Cell index on a 15x15 board. */
export const at = (row: number, col: number, size = 15): number => row * size + col;

/** Plays X and O moves alternately, X first. `o` may be one shorter than `x`. */
export function play(config: Record<string, unknown>, x: number[], o: number[]): CaroState {
  if (o.length !== x.length && o.length !== x.length - 1)
    throw new Error('o must have x.length or x.length-1 moves');
  const moves: CaroMove[] = [];
  x.forEach((cell, i) => {
    moves.push({ cell });
    const reply = o[i];
    if (reply !== undefined) moves.push({ cell: reply });
  });
  return playMoves(definition, config, moves);
}

/** Pattern with no 3 in a row in any direction: value = (floor(col / 2) + row) % 2. */
export function noWinPattern(size: number): (0 | 1)[] {
  return Array.from(
    { length: size * size },
    (_, i) => ((Math.floor((i % size) / 2) + Math.floor(i / size)) % 2) as 0 | 1,
  );
}
