import type { GameDefinition } from '@bg/engine';
import { applyMove, configSchema, legalMoves, moveSchema, result, setup, validateMove } from './rules';
import type { XiangqiConfig, XiangqiMove, XiangqiState } from './types';

export const definition: GameDefinition<XiangqiState, XiangqiMove, XiangqiConfig> = {
  meta: {
    id: 'xiangqi',
    rulesVersion: 1,
    minPlayers: 2,
    maxPlayers: 2,
    tags: ['perfect-info'],
    estimatedMinutes: 30,
    i18nKey: 'games.xiangqi',
  },
  configSchema,
  moveSchema,
  setup,
  activePlayers: (s) => (s.status === 'playing' ? [s.turn] : []),
  validateMove,
  applyMove,
  legalMoves,
  result,
  // Perfect information: everyone sees the whole state.
  playerView: (s) => s,
};
