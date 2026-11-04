import { createBot } from '@bg/bots';
import { definition } from '../rules/definition';
import { evaluate, orderMoves } from './evaluate';

export const bot = createBot({
  id: 'xiangqi.default',
  def: definition,
  evaluate,
  orderMoves,
  levels: {
    easy: { algo: 'greedy', timeMs: 300, noise: 0.3 },
    medium: { algo: 'minimax', timeMs: 800, maxDepth: 3, maxBranching: 16 },
    hard: { algo: 'minimax', timeMs: 2000, maxDepth: 5, maxBranching: 14 },
  },
});

export { evaluate, orderMoves };
