import type { CaroConfig, CaroState } from './types';

export function setup(config: CaroConfig): CaroState {
  return {
    config,
    board: Array.from({ length: config.size * config.size }, () => null),
    turn: 0,
    moveCount: 0,
    lastMove: null,
    winner: null,
    winLine: null,
  };
}
