import type { FourConfig, FourState } from './types';

export function setup(config: FourConfig): FourState {
  return {
    config,
    board: Array.from({ length: config.columns * config.rows }, () => null),
    turn: 0,
    moveCount: 0,
    lastMove: null,
    winner: null,
    winLine: null,
  };
}
