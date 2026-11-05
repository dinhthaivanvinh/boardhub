import type { GameDefinition } from '@bg/engine';
import { applyMove, configSchema, legalMoves, moveSchema, result, setup, validateMove } from './rules';
import type { CoGanhConfig, CoGanhMove, CoGanhState } from './types';

export const definition: GameDefinition<CoGanhState, CoGanhMove, CoGanhConfig> = {
  meta: {
    id: 'co-ganh',
    rulesVersion: 1,
    minPlayers: 2,
    maxPlayers: 2,
    tags: ['perfect-info'],
    estimatedMinutes: 10,
    i18nKey: 'games.co-ganh',
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
