import type { GameDefinition } from '@bg/engine';
import { applyMove, configSchema, legalMoves, moveSchema, result, setup, validateMove } from './rules';
import type { ChessConfig, ChessMove, ChessState } from './types';

export const definition: GameDefinition<ChessState, ChessMove, ChessConfig> = {
  meta: {
    id: 'chess',
    rulesVersion: 1,
    minPlayers: 2,
    maxPlayers: 2,
    tags: ['perfect-info'],
    estimatedMinutes: 20,
    i18nKey: 'games.chess',
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
