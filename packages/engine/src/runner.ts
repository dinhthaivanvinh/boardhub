import { createRng } from './rng';
import type { EngineContext, GameDefinition, GameResult, MoveRejection, Seat } from './types';

export type RunMoveResult<S> = { ok: true; state: S; result: GameResult | null } | MoveRejection;

/**
 * The only way a move should be applied, on both client and server.
 * Checks game-over, turn order, move shape and game rules, then applies the move.
 */
export function runMove<S, M, C>(
  def: GameDefinition<S, M, C>,
  state: S,
  seat: Seat,
  rawMove: unknown,
  ctx: EngineContext,
): RunMoveResult<S> {
  if (def.result(state)) return { ok: false, code: 'engine.game_over' };
  if (!def.activePlayers(state).includes(seat)) return { ok: false, code: 'engine.not_your_turn' };

  const parsed = def.moveSchema.safeParse(rawMove);
  if (!parsed.success) return { ok: false, code: 'engine.invalid_move_shape' };

  const check = def.validateMove(state, seat, parsed.data);
  if (!check.ok) return check;

  const next = def.applyMove(state, seat, parsed.data, ctx);
  return { ok: true, state: next, result: def.result(next) };
}

export interface RecordedMove {
  seat: Seat;
  move: unknown;
}

export class InvalidMatchError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'InvalidMatchError';
  }
}

/** Parses config (filling defaults) and builds the initial state. */
export function setupMatch<S, M, C>(
  def: GameDefinition<S, M, C>,
  rawConfig: unknown,
  playerCount: number,
  seed: string,
): { config: C; state: S } {
  const { minPlayers, maxPlayers } = def.meta;
  if (!Number.isInteger(playerCount) || playerCount < minPlayers || playerCount > maxPlayers) {
    throw new InvalidMatchError(
      `${def.meta.id} needs ${minPlayers}-${maxPlayers} players, got ${playerCount}`,
      'engine.invalid_player_count',
    );
  }
  const parsed = def.configSchema.safeParse(rawConfig ?? {});
  if (!parsed.success) {
    throw new InvalidMatchError(
      `invalid config for ${def.meta.id}: ${parsed.error.message}`,
      'engine.invalid_config',
    );
  }
  const config = parsed.data;
  return { config, state: def.setup(config, playerCount, { rng: createRng(seed, -1) }) };
}

/** Rebuilds a match from its seed and recorded moves (replay, takeback, dispute checks). */
export function replayMatch<S, M, C>(
  def: GameDefinition<S, M, C>,
  rawConfig: unknown,
  playerCount: number,
  seed: string,
  moves: readonly RecordedMove[],
): S {
  let { state } = setupMatch(def, rawConfig, playerCount, seed);
  moves.forEach(({ seat, move }, index) => {
    const res = runMove(def, state, seat, move, { rng: createRng(seed, index) });
    if (!res.ok) throw new InvalidMatchError(`move #${index} rejected: ${res.code}`, res.code);
    state = res.state;
  });
  return state;
}
