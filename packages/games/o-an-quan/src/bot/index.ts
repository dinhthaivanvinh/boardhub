import { createBot } from '@bg/bots';
import type { Seat } from '@bg/engine';
import { definition } from '../rules/definition';
import { ownSquares, QUAN_VALUE } from '../rules/rules';
import type { OAnQuanState } from '../rules/types';

/** Captured points (net of debts) for `seat` minus the opponent's, plus a little for dân still on each row. */
export function evaluate(s: OAnQuanState, seat: Seat): number {
  const me = seat === 0 ? 0 : 1;
  const them = me === 0 ? 1 : 0;
  const banked = (x: 0 | 1) =>
    s.stash[x]!.dan + QUAN_VALUE * s.stash[x]!.quan - s.debt[x] + s.debt[x === 0 ? 1 : 0];
  const row = (x: 0 | 1) => ownSquares(x).reduce((n, i) => n + s.cells[i]!, 0);
  return banked(me) - banked(them) + 0.3 * (row(me) - row(them));
}

export const bot = createBot({
  id: 'o-an-quan.default',
  def: definition,
  evaluate,
  levels: {
    easy: { algo: 'greedy', timeMs: 200, noise: 0.35 },
    medium: { algo: 'minimax', timeMs: 600, maxDepth: 3 },
    hard: { algo: 'minimax', timeMs: 1500, maxDepth: 5 },
  },
});
