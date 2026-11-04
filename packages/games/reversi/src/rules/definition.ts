import type { GameDefinition } from '@bg/engine';
import { configSchema } from './config';
import { applyMove, legalMoves, moveSchema, result, setup, validateMove } from './rules';
import type { ReversiConfig, ReversiMove, ReversiState } from './types';

export const definition: GameDefinition<ReversiState, ReversiMove, ReversiConfig> = {
  meta: {
    id: 'reversi',
    rulesVersion: 1,
    minPlayers: 2,
    maxPlayers: 2,
    tags: ['perfect-info'],
    estimatedMinutes: 10,
    i18nKey: 'games.reversi',
  },
  configSchema,
  moveSchema,
  setup,
  activePlayers: (s) => (s.over ? [] : [s.turn]),
  validateMove,
  applyMove,
  legalMoves,
  result,
  // Perfect information: everyone sees the whole state.
  playerView: (s) => s,
};
