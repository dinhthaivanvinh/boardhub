/**
 * Test helpers shared by every game (docs/10-testing-strategy.md).
 * Framework-agnostic: they throw EngineAssertionError instead of calling expect().
 */
import { createRng } from '../rng';
import { runMove, setupMatch, replayMatch, type RecordedMove } from '../runner';
import { stableStringify } from '../stable-stringify';
import type { GameDefinition, GameResult, Rng, Seat, Viewer } from '../types';

export class EngineAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineAssertionError';
  }
}

/** Plays moves in order; each move is made by the first active seat. Throws on any rejected move. */
export function playMoves<S, M, C>(
  def: GameDefinition<S, M, C>,
  rawConfig: unknown,
  moves: readonly M[],
  opts: { seed?: string; players?: number } = {},
): S {
  const seed = opts.seed ?? 'test';
  let { state } = setupMatch(def, rawConfig, opts.players ?? def.meta.minPlayers, seed);
  moves.forEach((move, index) => {
    const seat = def.activePlayers(state)[0];
    if (seat === undefined) {
      throw new EngineAssertionError(`move #${index} ${JSON.stringify(move)}: no active player`);
    }
    const res = runMove(def, state, seat, move, { rng: createRng(seed, index) });
    if (!res.ok) {
      throw new EngineAssertionError(`move #${index} ${JSON.stringify(move)} rejected: ${res.code}`);
    }
    state = res.state;
  });
  return state;
}

export interface PlayoutOptions<S> {
  players?: number;
  /** Called with the initial state (ply 0) and after every move. */
  eachStep?: (state: S, ply: number) => void;
  /** Deep-freeze each state before applyMove, so any mutation throws (rule E5). */
  freeze?: boolean;
}

export interface PlayoutResult<S> {
  state: S;
  result: GameResult;
  moves: RecordedMove[];
}

/** Plays uniformly random legal moves until the game ends. Requires def.legalMoves. */
export function randomPlayout<S, M, C>(
  def: GameDefinition<S, M, C>,
  config: C,
  seed: string,
  maxPlies: number,
  opts: PlayoutOptions<S> = {},
): PlayoutResult<S> {
  const legalMoves = requireLegalMoves(def);
  const chooser = createRng(`playout:${seed}`, 0);
  let state = def.setup(config, opts.players ?? def.meta.minPlayers, { rng: createRng(seed, -1) });
  opts.eachStep?.(state, 0);
  const moves: RecordedMove[] = [];

  for (let ply = 0; ; ply++) {
    const result = def.result(state);
    const active = def.activePlayers(state);
    if (result) {
      if (active.length > 0) {
        throw new EngineAssertionError(
          `seed ${seed}: game is over but activePlayers = [${active.join(',')}]`,
        );
      }
      return { state, result, moves };
    }
    if (ply >= maxPlies) throw new EngineAssertionError(`seed ${seed}: no result after ${maxPlies} plies`);
    if (active.length === 0) throw new EngineAssertionError(`seed ${seed}: no active players and no result`);

    const seat = pick(chooser, active);
    const legal = legalMoves(state, seat);
    if (legal.length === 0) {
      throw new EngineAssertionError(
        `seed ${seed} ply ${ply}: seat ${seat} is active but has no legal moves`,
      );
    }
    const move = pick(chooser, legal);
    if (opts.freeze) deepFreeze(state);
    const res = runMove(def, state, seat, move, { rng: createRng(seed, ply) });
    if (!res.ok) {
      throw new EngineAssertionError(
        `seed ${seed} ply ${ply}: legal move ${JSON.stringify(move)} was rejected: ${res.code}`,
      );
    }
    state = res.state;
    moves.push({ seat, move });
    opts.eachStep?.(state, ply + 1);
  }
}

/**
 * Rule E7: every move from legalMoves passes validateMove, with no duplicates.
 * If `candidates` is given, also checks the reverse: a candidate is valid exactly when it is in legalMoves.
 */
export function assertLegalMovesConsistent<S, M, C>(
  def: GameDefinition<S, M, C>,
  state: S,
  candidates?: readonly M[],
): void {
  const legalMoves = requireLegalMoves(def);
  for (const seat of def.activePlayers(state)) {
    const legal = legalMoves(state, seat);
    const keys = new Set<string>();
    for (const move of legal) {
      const key = stableStringify(move);
      if (keys.has(key)) throw new EngineAssertionError(`seat ${seat}: duplicate legal move ${key}`);
      keys.add(key);
      const check = def.validateMove(state, seat, move);
      if (!check.ok)
        throw new EngineAssertionError(`seat ${seat}: legal move ${key} fails validateMove: ${check.code}`);
    }
    for (const move of candidates ?? []) {
      const valid = def.validateMove(state, seat, move).ok;
      const listed = keys.has(stableStringify(move));
      if (valid !== listed) {
        throw new EngineAssertionError(
          `seat ${seat}: move ${stableStringify(move)} validateMove=${valid} but inLegalMoves=${listed}`,
        );
      }
    }
  }
}

/** Rule E4: only null, boolean, finite number, string, plain arrays and plain objects. */
export function assertSerializable(value: unknown, path = 'state'): void {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new EngineAssertionError(`${path} is not a finite number: ${value}`);
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (!(i in value)) throw new EngineAssertionError(`${path}[${i}] is a hole in a sparse array`);
      assertSerializable(value[i], `${path}[${i}]`);
    }
    return;
  }
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value) as unknown;
    if (proto !== Object.prototype && proto !== null) {
      throw new EngineAssertionError(
        `${path} is not a plain object (${value.constructor?.name ?? 'unknown'})`,
      );
    }
    for (const [k, v] of Object.entries(value)) assertSerializable(v, `${path}.${k}`);
    return;
  }
  throw new EngineAssertionError(`${path} has non-serializable type ${typeof value}`);
}

/** Rule E5: applyMove never mutates its input. */
export function assertNoMutation<S, M, C>(
  def: GameDefinition<S, M, C>,
  config: C,
  games: number,
  opts: { players?: number; maxPlies?: number } = {},
): void {
  for (let g = 0; g < games; g++) {
    try {
      randomPlayout(def, config, `mutation-${g}`, opts.maxPlies ?? 10_000, {
        ...playersOpt(opts),
        freeze: true,
      });
    } catch (err) {
      if (err instanceof TypeError) {
        throw new EngineAssertionError(`game ${g}: applyMove mutated a frozen state: ${err.message}`);
      }
      throw err;
    }
  }
}

/** Rules E2/E3: the same seed and moves always give the same states, live and through replayMatch. */
export function assertDeterministic<S, M, C>(
  def: GameDefinition<S, M, C>,
  config: C,
  games: number,
  opts: { players?: number; maxPlies?: number } = {},
): void {
  const players = opts.players ?? def.meta.minPlayers;
  for (let g = 0; g < games; g++) {
    const seed = `determinism-${g}`;
    const traces: string[][] = [[], []];
    let last: PlayoutResult<S> | undefined;
    for (const trace of traces) {
      last = randomPlayout(def, config, seed, opts.maxPlies ?? 10_000, {
        players,
        eachStep: (s) => trace.push(stableStringify(s)),
      });
    }
    const [a, b] = traces as [string[], string[]];
    if (a.length !== b.length)
      throw new EngineAssertionError(`seed ${seed}: playouts have different lengths`);
    a.forEach((s, i) => {
      if (s !== b[i]) throw new EngineAssertionError(`seed ${seed}: states differ at ply ${i}`);
    });
    const replayed = replayMatch(def, config, players, seed, last!.moves);
    if (stableStringify(replayed) !== a[a.length - 1]) {
      throw new EngineAssertionError(`seed ${seed}: replayMatch gives a different final state`);
    }
  }
}

/**
 * Rule E10: a viewer's view must not change when information hidden from them changes.
 * `resampleHidden` returns a copy of `state` with everything `viewer` must not see randomly re-drawn.
 */
export function assertNoHiddenLeak<S, M, C>(
  def: GameDefinition<S, M, C>,
  state: S,
  resampleHidden: (state: S, viewer: Viewer, rng: Rng) => S,
  opts: { players: number; samples?: number; seed?: string },
): void {
  const viewers: Viewer[] = [...Array.from({ length: opts.players }, (_, i) => i), 'spectator'];
  for (const viewer of viewers) {
    const expected = stableStringify(def.playerView(state, viewer));
    for (let i = 0; i < (opts.samples ?? 20); i++) {
      const alt = resampleHidden(state, viewer, createRng(opts.seed ?? 'leak', i));
      if (stableStringify(def.playerView(alt, viewer)) !== expected) {
        throw new EngineAssertionError(`viewer ${String(viewer)} can see hidden information (sample ${i})`);
      }
    }
  }
}

function requireLegalMoves<S, M, C>(def: GameDefinition<S, M, C>): (state: S, seat: Seat) => M[] {
  const fn = def.legalMoves;
  if (!fn) throw new EngineAssertionError(`${def.meta.id} does not implement legalMoves`);
  return fn.bind(def);
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[rng.int(0, items.length)] as T;
}

function playersOpt(opts: { players?: number }): { players?: number } {
  return opts.players === undefined ? {} : { players: opts.players };
}

function deepFreeze(value: unknown): void {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
}
