import { createRng, setupMatch, runMove, type GameDefinition, type Seat } from '@bg/engine';

export type ArenaPlayer<S, M> = (state: S, seat: Seat, game: number, ply: number) => M;

export interface ArenaStats {
  /** wins[i] = games won by player i (players swap seats every game). */
  wins: [number, number];
  draws: number;
}

/** Plays two bots against each other, swapping seats each game. Used to check bot strength (docs/07). */
export function playArena<S, M, C>(
  def: GameDefinition<S, M, C>,
  rawConfig: unknown,
  players: [ArenaPlayer<S, M>, ArenaPlayer<S, M>],
  games: number,
  seed = 'arena',
): ArenaStats {
  const stats: ArenaStats = { wins: [0, 0], draws: 0 };
  for (let g = 0; g < games; g++) {
    const gameSeed = `${seed}-${g}`;
    // Even games: player 0 sits in seat 0. Odd games: swapped.
    const playerAt = (seat: Seat) => (g % 2 === 0 ? seat : 1 - seat);
    let { state } = setupMatch(def, rawConfig, 2, gameSeed);
    for (let ply = 0; ; ply++) {
      const result = def.result(state);
      if (result) {
        if (result.kind === 'draw') stats.draws++;
        else stats.wins[playerAt(result.winners[0] as Seat) as 0 | 1]++;
        break;
      }
      const seat = def.activePlayers(state)[0] as Seat;
      const move = players[playerAt(seat) as 0 | 1](state, seat, g, ply);
      const res = runMove(def, state, seat, move, { rng: createRng(gameSeed, ply) });
      if (!res.ok)
        throw new Error(`arena game ${g} ply ${ply}: illegal move ${JSON.stringify(move)} (${res.code})`);
      state = res.state;
    }
  }
  return stats;
}
