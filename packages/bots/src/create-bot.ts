import type { GameDefinition, Rng, Seat } from '@bg/engine';
import { iterativeDeepening, movesFor, type SearchHooks } from './search';
import type { Bot, BotInput, BotLevel, LevelConfig } from './types';

export interface CreateBotOptions<S, M, C> extends Partial<SearchHooks<S, M>> {
  id: string;
  def: GameDefinition<S, M, C>;
  levels: Partial<Record<BotLevel, LevelConfig>>;
}

/** Uniformly random legal move. Used for the easiest level and as the fallback (rule B3). */
export function randomMove<S, M, C>(def: GameDefinition<S, M, C>, state: S, seat: Seat, rng: Rng): M {
  const legal = def.legalMoves?.(state, seat) ?? [];
  const move = legal[rng.int(0, Math.max(1, legal.length))];
  if (move === undefined) throw new Error(`${def.meta.id}: bot asked to move but there are no legal moves`);
  return move;
}

export function createBot<S, M, C>(opts: CreateBotOptions<S, M, C>): Bot<S, M> {
  const { def } = opts;
  const levels = Object.keys(opts.levels) as BotLevel[];

  const think = (input: BotInput<S>, cfg: LevelConfig): M => {
    const { state, seat, rng } = input;
    if (cfg.algo === 'random') return randomMove(def, state, seat, rng);
    if (!opts.evaluate) throw new Error(`${opts.id}: level "${cfg.algo}" needs an evaluate function`);
    const hooks: SearchHooks<S, M> = { ...opts, evaluate: opts.evaluate };

    // Rule B6: easier levels sometimes play a random (but sensible) move.
    if (cfg.noise && rng.next() < cfg.noise) {
      const candidates = movesFor(def, hooks, state, seat);
      const pick = candidates[rng.int(0, Math.max(1, candidates.length))];
      if (pick !== undefined) return pick;
    }

    const now = input.now ?? Date.now;
    const found = iterativeDeepening(def, hooks, state, seat, {
      maxDepth: cfg.algo === 'greedy' ? 1 : (cfg.maxDepth ?? 64),
      ...(cfg.maxBranching === undefined ? {} : { maxBranching: cfg.maxBranching }),
      deadlineMs: Math.min(input.deadlineMs, now() + cfg.timeMs),
      now,
      ctx: { rng },
    });
    if (found.move === null) throw new Error(`${opts.id}: search found no move`);
    return found.move;
  };

  return {
    id: opts.id,
    levels,
    chooseMove(input) {
      const cfg = opts.levels[input.level] ?? opts.levels[levels[0] as BotLevel];
      try {
        if (!cfg) throw new Error(`${opts.id}: no levels configured`);
        const move = think(input, cfg);
        // Rule B3: never return an illegal move.
        if (def.validateMove(input.state, input.seat, move).ok) return move;
        throw new Error(`${opts.id}: chose an illegal move ${JSON.stringify(move)}`);
      } catch (err) {
        console.error(err);
        return randomMove(def, input.state, input.seat, input.rng);
      }
    },
  };
}
