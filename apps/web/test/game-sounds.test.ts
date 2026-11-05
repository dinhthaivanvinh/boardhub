import { describe, expect, it } from 'vitest';
import { createRng, runMove, setupMatch, type AnyGameDefinition } from '@bg/engine';
import type { SoundCue } from '@bg/ui';
import { definition as banTau } from '@bg/game-ban-tau/rules';
import { definition as chess } from '@bg/game-chess/rules';
import { definition as reversi } from '@bg/game-reversi/rules';
import { GAME_IDS, GAMES } from '../src/games/catalog';
import { CLIENT_GAMES } from '../src/games/client-registry';

/** Plays moves through the real rules and returns the view of `viewer` after each. */
function views(def: AnyGameDefinition, moves: { seat: number; move: unknown }[], viewer = 0) {
  let { state } = setupMatch(def, {}, 2, 'seed');
  const out = [def.playerView(state, viewer)];
  moves.forEach(({ seat, move }, i) => {
    const res = runMove(def, state, seat, move, { rng: createRng('seed', i) });
    if (!res.ok) throw new Error(`move ${i}: ${res.code}`);
    state = res.state;
    out.push(def.playerView(state, viewer));
  });
  return out;
}

const kinds = (cues: SoundCue[]) => cues.map((c) => c.kind);
const sq = (name: string) => (8 - Number(name[1])) * 8 + 'abcdefgh'.indexOf(name[0]!);

describe('move sounds', () => {
  it('every game names a sound for its moves (Ô ăn quan sounds each stone on its board)', () => {
    for (const id of GAME_IDS) {
      const def = GAMES[id].definition;
      let { state } = setupMatch(def, {}, def.meta.minPlayers, 'seed');
      const rng = createRng('sounds', 0);
      for (let i = 0; i < 6 && !def.result(state); i++) {
        const seat = def.activePlayers(state)[0]!;
        const legal = def.legalMoves!(state, seat);
        const move = legal[rng.int(0, legal.length)]!;
        const before = def.playerView(state, seat);
        const res = runMove(def, state, seat, move, { rng: createRng('seed', i) });
        if (!res.ok) throw new Error(`${id}: ${res.code}`);
        state = res.state;
        const cues = CLIENT_GAMES[id].moveSounds(before, def.playerView(state, seat));
        if (id === 'o-an-quan') expect(cues).toEqual([]);
        else expect(cues.length, id).toBeGreaterThan(0);
      }
      expect(['calm', 'folk', 'sea']).toContain(CLIENT_GAMES[id].music);
    }
  });

  it('chess: a plain move, a capture, and a check', () => {
    const m = (seat: number, from: string, to: string) => ({ seat, move: { from: sq(from), to: sq(to) } });
    const v = views(chess, [
      m(0, 'e2', 'e4'),
      m(1, 'd7', 'd5'),
      m(0, 'e4', 'd5'),
      m(1, 'f7', 'f6'),
      m(0, 'd1', 'h5'),
    ]);
    const s = CLIENT_GAMES.chess.moveSounds;
    expect(kinds(s(v[0], v[1]))).toEqual(['move']);
    expect(kinds(s(v[2], v[3]))).toEqual(['capture']);
    expect(kinds(s(v[4], v[5]))).toEqual(['move', 'check']);
  });

  it('reversi: the disc goes down, then the turned discs are counted', () => {
    const v = views(reversi, [
      { seat: 0, move: reversi.legalMoves!(setupMatch(reversi, {}, 2, 'seed').state, 0)[0] },
    ]);
    expect(CLIENT_GAMES.reversi.moveSounds(v[0], v[1])).toEqual([
      { kind: 'place' },
      { kind: 'flip', count: 1, delay: 120 },
    ]);
  });

  it('Bắn tàu: ready after placing, splash for a miss, hit, and hit + sunk', () => {
    const s = CLIENT_GAMES['ban-tau'].moveSounds;
    let { state } = setupMatch(banTau, {}, 2, 'seed');
    const place = (seat: number) => {
      const before = banTau.playerView(state, 0);
      const move = banTau.legalMoves!(state, seat)[0];
      const res = runMove(banTau, state, seat, move, { rng: createRng('seed', seat) });
      if (!res.ok) throw new Error(res.code);
      state = res.state;
      return s(before, banTau.playerView(state, 0));
    };
    expect(kinds(place(0))).toEqual(['ready']);
    place(1);

    // Fire at seat 1's ships, cell by cell, until one ship is sunk; one miss first.
    const st = state as unknown as { fleets: { cells: number[] }[][] };
    const target = [...st.fleets[1]!].sort((a, b) => a.cells.length - b.cells.length)[0]!;
    const occupied = new Set(st.fleets[1]!.flatMap((x) => x.cells));
    const water = Array.from({ length: 100 }, (_, i) => i).find((c) => !occupied.has(c))!;
    const fire = (seat: number, cell: number) => {
      const before = banTau.playerView(state, 0);
      const res = runMove(
        banTau,
        { ...(state as object), turn: seat } as typeof state,
        seat,
        { kind: 'fire', cell },
        {
          rng: createRng('seed', 9),
        },
      );
      if (!res.ok) throw new Error(res.code);
      state = res.state;
      return kinds(s(before, banTau.playerView(state, 0)));
    };
    expect(fire(0, water)).toEqual(['splash']);
    const cells = target.cells;
    cells.slice(0, -1).forEach((c) => expect(fire(0, c)).toEqual(['hit']));
    expect(fire(0, cells.at(-1)!)).toEqual(['hit', 'sunk']);
  });
});
