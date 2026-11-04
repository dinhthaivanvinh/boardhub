import type { Rng, Seat } from '@bg/engine';

export type BotLevel = 'easy' | 'medium' | 'hard';
export const BOT_LEVELS: readonly BotLevel[] = ['easy', 'medium', 'hard'];

export interface BotInput<S> {
  /** Server bots get the full state; hidden-info games must pass playerView instead (rule B4). */
  state: S;
  seat: Seat;
  level: BotLevel;
  /** Seeded, so a bot decision can be reproduced (rule B1). */
  rng: Rng;
  /** Absolute time (same clock as `now`) by which a move must be returned (rule B2). */
  deadlineMs: number;
  /** Clock, defaults to Date.now. Injected in tests. */
  now?: () => number;
}

export interface Bot<S, M> {
  id: string;
  levels: BotLevel[];
  chooseMove(input: BotInput<S>): M;
}

export type LevelConfig =
  | { algo: 'random'; timeMs?: number }
  | { algo: 'greedy'; timeMs: number; noise?: number; maxBranching?: number }
  | { algo: 'minimax'; timeMs: number; maxDepth?: number; noise?: number; maxBranching?: number };
