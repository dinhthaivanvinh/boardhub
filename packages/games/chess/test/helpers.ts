import { fromFen, squareOf } from '../src/rules/board';
import { definition } from '../src/rules/definition';
import { setup, stateFromPosition } from '../src/rules/rules';
import type { ChessState, Promotion } from '../src/rules/types';

export const ctx = { rng: undefined as never };
export const s = squareOf;

/** A game state from a FEN position. */
export const fen = (f: string): ChessState => stateFromPosition(fromFen(f));

/** Plays moves written as "e2e4" or "e7e8q" from a state (the start position by default). */
export function play(moves: string[], from: ChessState = setup({})): ChessState {
  let state = from;
  for (const m of moves) {
    const move = {
      from: squareOf(m.slice(0, 2)),
      to: squareOf(m.slice(2, 4)),
      ...(m[4] ? { promotion: m[4].toUpperCase() as Promotion } : {}),
    };
    const check = definition.validateMove(state, state.turn, move);
    if (!check.ok) throw new Error(`${m} rejected: ${check.code}`);
    state = definition.applyMove(state, state.turn, move, ctx);
  }
  return state;
}

/** Legal destinations of the piece on `square`, as names. */
export function targetsOf(state: ChessState, square: string): string[] {
  const names = 'abcdefgh';
  return definition.legalMoves!(state, state.turn)
    .filter((m) => m.from === squareOf(square))
    .map((m) => `${names[m.to & 7]}${8 - (m.to >> 3)}`)
    .sort();
}
