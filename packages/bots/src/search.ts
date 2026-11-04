import type { EngineContext, GameDefinition, GameResult, Seat } from '@bg/engine';

export const WIN_SCORE = 1_000_000_000;

export interface SearchHooks<S, M> {
  /** Score of `state` for `seat`; higher is better. */
  evaluate(state: S, seat: Seat): number;
  /** Moves to consider; defaults to def.legalMoves. Must be a subset of the legal moves. */
  candidateMoves?(state: S, seat: Seat): M[];
  /** Best-first ordering helps alpha-beta prune more. */
  orderMoves?(state: S, moves: M[], seat: Seat): M[];
}

export interface SearchOptions {
  maxDepth: number;
  maxBranching?: number;
  deadlineMs: number;
  now: () => number;
  ctx: EngineContext;
}

export interface SearchResult<M> {
  move: M | null;
  score: number;
  depth: number;
}

class Timeout extends Error {}

/** Score of a finished game for `seat`. Faster wins and slower losses score better. */
export function terminalScore(result: GameResult, seat: Seat, ply: number): number {
  if (result.kind === 'draw') return 0;
  return result.winners.includes(seat) ? WIN_SCORE - ply : -WIN_SCORE + ply;
}

export function movesFor<S, M, C>(
  def: GameDefinition<S, M, C>,
  hooks: SearchHooks<S, M>,
  state: S,
  seat: Seat,
  maxBranching?: number,
): M[] {
  let moves = hooks.candidateMoves
    ? hooks.candidateMoves(state, seat)
    : (def.legalMoves?.(state, seat) ?? []);
  if (hooks.orderMoves) moves = hooks.orderMoves(state, moves, seat);
  return maxBranching !== undefined && moves.length > maxBranching ? moves.slice(0, maxBranching) : moves;
}

/**
 * Minimax with alpha-beta pruning and iterative deepening.
 * Works for any number of players: the root seat maximizes, every other seat minimizes.
 * Handles games where the same seat moves twice in a row (pass rules).
 * Returns the best move of the deepest fully searched depth.
 */
export function iterativeDeepening<S, M, C>(
  def: GameDefinition<S, M, C>,
  hooks: SearchHooks<S, M>,
  root: S,
  seat: Seat,
  opts: SearchOptions,
): SearchResult<M> {
  let rootMoves = movesFor(def, hooks, root, seat, opts.maxBranching);
  let best: SearchResult<M> = { move: rootMoves[0] ?? null, score: -Infinity, depth: 0 };
  let nodes = 0;
  // True if some line was cut off by the depth limit (so a deeper search could change the answer).
  let hitHorizon: boolean;

  const checkTime = () => {
    if ((nodes++ & 63) === 0 && opts.now() > opts.deadlineMs) throw new Timeout();
  };

  const search = (state: S, depth: number, alpha: number, beta: number, ply: number): number => {
    checkTime();
    const result = def.result(state);
    if (result) return terminalScore(result, seat, ply);
    if (depth === 0) {
      hitHorizon = true;
      return hooks.evaluate(state, seat);
    }

    const mover = def.activePlayers(state)[0];
    if (mover === undefined) return hooks.evaluate(state, seat);
    const moves = movesFor(def, hooks, state, mover, opts.maxBranching);
    if (moves.length === 0) return hooks.evaluate(state, seat);

    const maximizing = mover === seat;
    let value = maximizing ? -Infinity : Infinity;
    for (const move of moves) {
      const child = def.applyMove(state, mover, move, opts.ctx);
      const score = search(child, depth - 1, alpha, beta, ply + 1);
      if (maximizing) {
        if (score > value) value = score;
        if (value > alpha) alpha = value;
      } else {
        if (score < value) value = score;
        if (value < beta) beta = value;
      }
      if (alpha >= beta) break;
    }
    return value;
  };

  for (let depth = 1; depth <= opts.maxDepth && rootMoves.length > 0; depth++) {
    let depthBest: SearchResult<M> = { move: null, score: -Infinity, depth };
    hitHorizon = false;
    try {
      let alpha = -Infinity;
      for (const move of rootMoves) {
        const child = def.applyMove(root, seat, move, opts.ctx);
        const score = search(child, depth - 1, alpha, Infinity, 1);
        if (score > depthBest.score) depthBest = { move, score, depth };
        if (score > alpha) alpha = score;
      }
    } catch (err) {
      if (!(err instanceof Timeout)) throw err;
      // Depth 1 never finished: keep whatever the partial search found.
      if (best.depth === 0 && depthBest.move !== null) best = depthBest;
      break;
    }
    best = depthBest;
    if (best.score >= WIN_SCORE - 1_000) break; // forced win found, no need to look deeper
    if (!hitHorizon) break; // the whole game tree was searched, the answer is exact
    // Search the best move first at the next depth.
    rootMoves = [best.move as M, ...rootMoves.filter((m) => m !== best.move)];
  }
  return best;
}
