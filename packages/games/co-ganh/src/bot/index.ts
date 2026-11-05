import { createBot } from '@bg/bots';
import type { Seat } from '@bg/engine';
import { countPieces, isStrongPoint, NEIGHBOURS, playOnBoard, POINTS } from '../rules/board';
import { definition } from '../rules/definition';
import type { CoGanhMove, CoGanhState } from '../rules/types';

/** Pieces (×100) + mobility + a little for strong points (more lines = more ways to carry), for `seat`. */
export function evaluate(s: CoGanhState, seat: Seat): number {
  const me = seat === 0 ? 0 : 1;
  const [red, blue] = countPieces(s.board);
  let score = (me === 0 ? red - blue : blue - red) * 100;
  for (let p = 0; p < POINTS; p++) {
    const v = s.board[p];
    if (v === null || v === undefined) continue;
    const sign = v === me ? 1 : -1;
    let free = 0;
    for (const q of NEIGHBOURS[p]!) if (s.board[q] === null) free++;
    score += sign * (free * 2 + (isStrongPoint(p) ? 3 : 0));
  }
  return score;
}

/** Moves that capture the most pieces first. */
export function orderMoves(s: CoGanhState, moves: CoGanhMove[]): CoGanhMove[] {
  return moves
    .map((m) => {
      const { carried, surrounded } = playOnBoard(s.board, m);
      return { m, gain: carried.length + surrounded.length };
    })
    .sort((a, b) => b.gain - a.gain || a.m.from - b.m.from || a.m.to - b.m.to)
    .map((x) => x.m);
}

export const bot = createBot({
  id: 'co-ganh.default',
  def: definition,
  evaluate,
  orderMoves,
  levels: {
    easy: { algo: 'greedy', timeMs: 200, noise: 0.35 },
    medium: { algo: 'minimax', timeMs: 600, maxDepth: 4 },
    hard: { algo: 'minimax', timeMs: 1500, maxDepth: 6 },
  },
});
