import type { GameDefinition } from '@bg/engine';
import {
  applyMove,
  configSchema,
  legalMoves,
  moveSchema,
  playerView,
  result,
  setup,
  validateMove,
} from './rules';
import type { BanTauConfig, BanTauMove, BanTauState } from './types';

export const definition: GameDefinition<BanTauState, BanTauMove, BanTauConfig> = {
  meta: {
    id: 'ban-tau',
    rulesVersion: 1,
    minPlayers: 2,
    maxPlayers: 2,
    tags: ['hidden-info'],
    estimatedMinutes: 15,
    i18nKey: 'games.ban-tau',
  },
  configSchema,
  moveSchema,
  setup,
  activePlayers: (s) => (s.phase === 'over' ? [] : [s.turn]),
  validateMove,
  applyMove,
  legalMoves,
  result,
  playerView,
};
