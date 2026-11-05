import { setup } from '../src/rules/rules';
import type { OAnQuanSeat, OAnQuanState } from '../src/rules/types';

/** A position: 12 counts in ring order (0 and 6 are the quan squares). */
export function position(
  cells: number[],
  opts: {
    quan?: [boolean, boolean];
    turn?: OAnQuanSeat;
    stash?: [{ dan: number; quan: number }, { dan: number; quan: number }];
    debt?: [number, number];
    moveCount?: number;
  } = {},
): OAnQuanState {
  if (cells.length !== 12) throw new Error('12 cells');
  return {
    ...setup({}),
    cells,
    quan: opts.quan ?? [true, true],
    turn: opts.turn ?? 0,
    stash: opts.stash ?? [
      { dan: 0, quan: 0 },
      { dan: 0, quan: 0 },
    ],
    debt: opts.debt ?? [0, 0],
    moveCount: opts.moveCount ?? 0,
  };
}
