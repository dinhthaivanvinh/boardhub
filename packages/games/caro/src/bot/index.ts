import { createBot } from '@bg/bots';
import { definition } from '../rules/definition';
import { candidateMoves, evaluate, orderMoves } from './evaluate';

export const bot = createBot({
  id: 'caro.default',
  def: definition,
  evaluate,
  candidateMoves,
  orderMoves,
  levels: {
    easy: { algo: 'greedy', timeMs: 200, noise: 0.3, maxBranching: 20 },
    medium: { algo: 'minimax', timeMs: 600, maxDepth: 2, maxBranching: 15 },
    hard: { algo: 'minimax', timeMs: 1500, maxDepth: 6, maxBranching: 10 },
  },
});

export { evaluate, candidateMoves, orderMoves };
