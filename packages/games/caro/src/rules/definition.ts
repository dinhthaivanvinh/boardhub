import type { GameDefinition } from '@bg/engine';
import { configSchema } from './config';
import { applyMove, legalMoves, moveSchema, validateMove } from './moves';
import { result } from './result';
import { setup } from './setup';
import type { CaroConfig, CaroMove, CaroState } from './types';

export const definition: GameDefinition<CaroState, CaroMove, CaroConfig> = {
  meta: {
    id: 'caro',
    rulesVersion: 1,
    minPlayers: 2,
    maxPlayers: 2,
    tags: ['perfect-info'],
    estimatedMinutes: 10,
    i18nKey: 'games.caro',
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
