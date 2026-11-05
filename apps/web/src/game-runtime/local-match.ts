import {
  createRng,
  replayMatch,
  runMove,
  setupMatch,
  type GameDefinition,
  type GameResult,
  type RecordedMove,
  type RunMoveResult,
  type Seat,
} from '@bg/engine';
import type { BotLevel } from '@bg/bots';
import { newLocalMatchId } from './local-history';
import type { SeatController } from './match-setup';

export interface LocalSnapshot<S> {
  /** Increases on every change; stale bot replies are dropped by comparing versions. */
  version: number;
  seed: string;
  state: S;
  moves: RecordedMove[];
  result: GameResult | null;
  activeSeats: Seat[];
}

/**
 * A match that runs entirely in the browser (modes `local` and `bot`).
 * Same engine, same RNG streams as the server, so a local match could be replayed anywhere.
 * Exposes subscribe/getSnapshot for React's useSyncExternalStore.
 */
export class LocalMatch<S, M, C> {
  private snap: LocalSnapshot<S>;
  private readonly listeners = new Set<() => void>();
  readonly config: C;
  /** Identity in the browser's history of local games (local-history.ts). */
  readonly id = newLocalMatchId();
  readonly startedAt = Date.now();

  constructor(
    readonly def: GameDefinition<S, M, C>,
    rawConfig: unknown,
    readonly controllers: readonly SeatController[],
    readonly seed: string,
  ) {
    const { config, state } = setupMatch(def, rawConfig, controllers.length, seed);
    this.config = config;
    this.snap = this.build(0, state, [], null);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): LocalSnapshot<S> => this.snap;

  submit(seat: Seat, move: unknown): RunMoveResult<S> {
    if (this.snap.result) return { ok: false, code: 'engine.game_over' };
    const index = this.snap.moves.length;
    const res = runMove(this.def, this.snap.state, seat, move, { rng: createRng(this.seed, index) });
    if (res.ok) this.update(res.state, [...this.snap.moves, { seat, move }], null);
    return res;
  }

  /** The bot that should move now, if any. */
  botToMove(): { seat: Seat; level: BotLevel } | null {
    if (this.snap.result) return null;
    for (const seat of this.snap.activeSeats) {
      const c = this.controllers[seat];
      if (c?.kind === 'bot') return { seat, level: c.level };
    }
    return null;
  }

  /** First active seat played by a human (hot-seat: whoever's turn it is). */
  humanToMove(): Seat | null {
    if (this.snap.result) return null;
    return this.snap.activeSeats.find((seat) => this.controllers[seat]?.kind === 'human') ?? null;
  }

  canUndo(): boolean {
    return this.lastHumanMoveIndex() >= 0;
  }

  /** Takes back the last human move and any bot replies after it. Also cancels a resignation. */
  undo(): boolean {
    const index = this.lastHumanMoveIndex();
    if (index < 0) return false;
    const moves = this.snap.moves.slice(0, index);
    const state = replayMatch(this.def, this.config, this.controllers.length, this.seed, moves);
    this.update(state, moves, null);
    return true;
  }

  /** Ends the match: the other seats win (or the game decides via onPlayerEliminated). */
  resign(seat: Seat): void {
    if (this.snap.result) return;
    if (this.def.onPlayerEliminated) {
      this.update(this.def.onPlayerEliminated(this.snap.state, seat, 'resign'), this.snap.moves, null);
      return;
    }
    const winners = this.controllers.map((_, s) => s).filter((s) => s !== seat);
    this.update(this.snap.state, this.snap.moves, { kind: 'win', winners, reason: 'resign' });
  }

  private lastHumanMoveIndex(): number {
    for (let i = this.snap.moves.length - 1; i >= 0; i--) {
      const seat = this.snap.moves[i]!.seat;
      if (this.controllers[seat]?.kind === 'human') return i;
    }
    return -1;
  }

  private update(state: S, moves: RecordedMove[], forcedResult: GameResult | null): void {
    this.snap = this.build(this.snap.version + 1, state, moves, forcedResult);
    for (const listener of this.listeners) listener();
  }

  private build(
    version: number,
    state: S,
    moves: RecordedMove[],
    forcedResult: GameResult | null,
  ): LocalSnapshot<S> {
    const result = forcedResult ?? this.def.result(state);
    return {
      version,
      seed: this.seed,
      state,
      moves,
      result,
      activeSeats: result ? [] : this.def.activePlayers(state),
    };
  }
}

/** Random seed that works on plain http too (crypto.randomUUID needs a secure context). */
export function newSeed(): string {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(36)).join('');
}
