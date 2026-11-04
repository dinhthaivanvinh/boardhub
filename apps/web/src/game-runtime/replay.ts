import { createRng, runMove, setupMatch, type AnyGameDefinition } from '@bg/engine';
import type { MatchDetail, MatchSummary } from '@bg/protocol';

/**
 * Every position of a finished match, from the start to the last move (docs/06 §3).
 * Same engine and RNG streams as the server, so the replay matches what was played.
 */
export function buildReplay(
  def: AnyGameDefinition,
  match: Pick<MatchDetail, 'config' | 'players' | 'seed' | 'moves'>,
): unknown[] {
  let { state } = setupMatch(def, match.config, match.players.length, match.seed);
  const states: unknown[] = [state];
  match.moves.forEach(({ seat, move }, index) => {
    const res = runMove(def, state, seat, move, { rng: createRng(match.seed, index) });
    if (!res.ok) throw new Error(`move ${index} cannot be replayed: ${res.code}`);
    state = res.state;
    states.push(state);
  });
  return states;
}

export type Outcome = 'win' | 'loss' | 'draw' | 'playing';

/** The match result from one player's point of view. */
export function outcomeFor(match: Pick<MatchSummary, 'result' | 'players'>, userId: string | null): Outcome {
  if (!match.result) return 'playing';
  if (match.result.kind === 'draw') return 'draw';
  const mySeat = match.players.find((p) => p.userId === userId)?.seat;
  return mySeat !== undefined && match.result.winners.includes(mySeat) ? 'win' : 'loss';
}
