import { createBot } from '@bg/bots';
import { definition } from '../rules/definition';
import { evaluate, orderMoves } from './evaluate';

export const bot = createBot({
  id: 'reversi.default',
  def: definition,
  evaluate,
  orderMoves,
  levels: {
    easy: { algo: 'greedy', timeMs: 200, noise: 0.3 },
    medium: { algo: 'minimax', timeMs: 600, maxDepth: 3 },
    hard: { algo: 'minimax', timeMs: 1500, maxDepth: 10 },
  },
});

export { evaluate, orderMoves };
