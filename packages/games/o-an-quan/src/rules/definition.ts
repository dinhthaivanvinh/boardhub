import type { GameDefinition } from '@bg/engine';
import { applyMove, configSchema, legalMoves, moveSchema, result, setup, validateMove } from './rules';
import type { OAnQuanConfig, OAnQuanMove, OAnQuanState } from './types';

export const definition: GameDefinition<OAnQuanState, OAnQuanMove, OAnQuanConfig> = {
  meta: {
    id: 'o-an-quan',
    rulesVersion: 1,
    minPlayers: 2,
    maxPlayers: 2,
    tags: ['perfect-info'],
    estimatedMinutes: 15,
    i18nKey: 'games.o-an-quan',
  },
  configSchema,
  moveSchema,
  setup,
  activePlayers: (s) => (s.ended ? [] : [s.turn]),
  validateMove,
  applyMove,
  legalMoves,
  result,
  // Perfect information: everyone sees the whole state.
  playerView: (s) => s,
};
