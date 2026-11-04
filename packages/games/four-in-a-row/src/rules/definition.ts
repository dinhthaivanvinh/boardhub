import type { GameDefinition } from '@bg/engine';
import { configSchema } from './config';
import { applyMove, legalMoves, moveSchema, validateMove } from './moves';
import { result } from './result';
import { setup } from './setup';
import type { FourConfig, FourMove, FourState } from './types';

export const definition: GameDefinition<FourState, FourMove, FourConfig> = {
  meta: {
    id: 'four-in-a-row',
    rulesVersion: 1,
    minPlayers: 2,
    maxPlayers: 2,
    tags: ['perfect-info'],
    estimatedMinutes: 5,
    i18nKey: 'games.four-in-a-row',
  },
  configSchema,
  moveSchema,
  setup,
  activePlayers: (s) => (result(s) ? [] : [s.turn]),
  validateMove,
  applyMove,
  legalMoves,
  result,
  // Perfect information: everyone sees the whole state.
  playerView: (s) => s,
};
