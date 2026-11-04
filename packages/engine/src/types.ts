import type { z } from 'zod';

/** Position in a match: 0..maxPlayers-1. The engine never knows about users. */
export type Seat = number;
export type Viewer = Seat | 'spectator';

export type GameTag = 'perfect-info' | 'chance' | 'hidden-info' | 'simultaneous' | 'multi-player';

export interface GameMeta {
  /** kebab-case, unique, never changes after release. */
  id: string;
  /** Bump when a rules change makes old matches replay differently. */
  rulesVersion: number;
  minPlayers: number;
  maxPlayers: number;
  tags: GameTag[];
  estimatedMinutes: number;
  /** e.g. 'games.caro' — name and description live in the game's i18n files. */
  i18nKey: string;
}

export type MoveRejection = { ok: false; code: string; params?: Record<string, unknown> };
export type MoveCheck = { ok: true } | MoveRejection;

export type GameResult = { kind: 'win'; winners: Seat[]; reason: string } | { kind: 'draw'; reason: string };

export type EliminationReason = 'resign' | 'timeout' | 'abandon';

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  int(minInclusive: number, maxExclusive: number): number;
  /** Returns a new shuffled array. */
  shuffle<T>(items: readonly T[]): T[];
}

export interface EngineContext {
  rng: Rng;
}

/** Contract every game implements. See docs/04-game-engine-spec.md. */
export interface GameDefinition<S, M, C> {
  meta: GameMeta;
  configSchema: z.ZodType<C>;
  moveSchema: z.ZodType<M>;
  setup(config: C, playerCount: number, ctx: EngineContext): S;
  /** Seats allowed to move now. Empty when the match is over. */
  activePlayers(state: S): Seat[];
  /** Must not change state. Turn order and game-over are checked by the runner. */
  validateMove(state: S, seat: Seat, move: M): MoveCheck;
  /** Returns a NEW state. Must not throw for a move that validateMove accepted. */
  applyMove(state: S, seat: Seat, move: M, ctx: EngineContext): S;
  result(state: S): GameResult | null;
  playerView(state: S, viewer: Viewer): unknown;
  legalMoves?(state: S, seat: Seat): M[];
  onPlayerEliminated?(state: S, seat: Seat, reason: EliminationReason): S;
}

/** Erased type used by registries that hold many games. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameDefinition = GameDefinition<any, any, any>;
