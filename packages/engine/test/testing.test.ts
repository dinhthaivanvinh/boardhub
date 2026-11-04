import { describe, expect, it } from 'vitest';
import type { GameDefinition, Seat } from '../src';
import {
  assertDeterministic,
  assertLegalMovesConsistent,
  assertNoHiddenLeak,
  assertNoMutation,
  assertSerializable,
  EngineAssertionError,
  playMoves,
  randomPlayout,
} from '../src/testing';
import { nim, type NimConfig, type NimMove, type NimState } from './nim';

const config: NimConfig = { minPile: 10, maxPile: 20 };

describe('helpers accept a correct game', () => {
  it('randomPlayout reaches a result for 2 and 3 players', () => {
    for (const players of [2, 3]) {
      for (let g = 0; g < 50; g++) {
        const out = randomPlayout(nim, config, `ok-${g}`, 100, {
          players,
          eachStep: (s) => {
            assertSerializable(s);
            assertLegalMovesConsistent(nim, s, [
              { take: 0 },
              { take: 1 },
              { take: 2 },
              { take: 3 },
              { take: 4 },
            ]);
          },
        });
        expect(out.result.kind).toBe('win');
      }
    }
  });

  it('assertNoMutation and assertDeterministic pass', () => {
    assertNoMutation(nim, config, 30);
    assertDeterministic(nim, config, 30, { players: 3 });
  });

  it('playMoves plays moves for the active seat', () => {
    const s = playMoves(nim, { minPile: 5, maxPile: 5 }, [{ take: 2 }, { take: 3 }]);
    expect(s).toMatchObject({ pile: 0, lastTaker: 1 });
    expect(() => playMoves(nim, { minPile: 5, maxPile: 5 }, [{ take: 9 }])).toThrow(/nim.bad_take/);
    expect(() => playMoves(nim, { minPile: 1, maxPile: 1 }, [{ take: 1 }, { take: 1 }])).toThrow(
      /game_over|no active/,
    );
  });
});

describe('helpers catch broken games', () => {
  it('catches a legal move that validateMove rejects', () => {
    const broken = { ...nim, legalMoves: (s: NimState) => [...nim.legalMoves!(s, 0), { take: 4 }] };
    expect(() =>
      assertLegalMovesConsistent(broken, { pile: 9, turn: 0, players: 2, lastTaker: null }),
    ).toThrow(EngineAssertionError);
  });

  it('catches a valid move missing from legalMoves', () => {
    const broken = { ...nim, legalMoves: () => [{ take: 1 }] };
    expect(() =>
      assertLegalMovesConsistent(broken, { pile: 9, turn: 0, players: 2, lastTaker: null }, [{ take: 2 }]),
    ).toThrow(/inLegalMoves=false/);
  });

  it('catches duplicate legal moves', () => {
    const broken = { ...nim, legalMoves: () => [{ take: 1 }, { take: 1 }] };
    expect(() =>
      assertLegalMovesConsistent(broken, { pile: 9, turn: 0, players: 2, lastTaker: null }),
    ).toThrow(/duplicate/);
  });

  it('catches non-serializable state', () => {
    expect(() => assertSerializable({ a: new Map() })).toThrow(/state.a is not a plain object/);
    expect(() => assertSerializable({ a: [1, undefined] })).toThrow(/state.a\[1\]/);
    expect(() => assertSerializable({ n: NaN })).toThrow(/finite/);
    // eslint-disable-next-line no-sparse-arrays
    expect(() => assertSerializable([1, , 3])).toThrow(/sparse/);
    expect(() => assertSerializable({ f: () => 1 })).toThrow(/function/);
  });

  it('catches applyMove mutating its input', () => {
    const broken: GameDefinition<NimState, NimMove, NimConfig> = {
      ...nim,
      applyMove: (s, seat, m) => {
        s.pile -= m.take;
        return { ...s, turn: (seat + 1) % s.players, lastTaker: seat };
      },
    };
    expect(() => assertNoMutation(broken, config, 1)).toThrow(/mutated a frozen state/);
  });

  it('catches non-deterministic randomness', () => {
    let calls = 0;
    const broken: GameDefinition<NimState, NimMove, NimConfig> = {
      ...nim,
      setup: (c, players) => ({ pile: c.minPile + (calls++ % 3), turn: 0, players, lastTaker: null }),
    };
    expect(() => assertDeterministic(broken, config, 1)).toThrow(EngineAssertionError);
  });

  it('catches a game that never ends', () => {
    const endless = {
      ...nim,
      applyMove: (s: NimState, seat: Seat) => ({ ...s, turn: (seat + 1) % s.players }),
    };
    expect(() => randomPlayout(endless, config, 'x', 50)).toThrow(/no result after 50/);
  });

  it('catches a game that is over but still has active players', () => {
    const broken = { ...nim, activePlayers: (s: NimState) => [s.turn] };
    expect(() => randomPlayout(broken, config, 'x', 100)).toThrow(/game is over but activePlayers/);
  });

  it('requires legalMoves for playouts', () => {
    const { legalMoves: _omit, ...noLegal } = nim;
    expect(() => randomPlayout(noLegal, config, 'x', 10)).toThrow(/does not implement legalMoves/);
  });
});

describe('assertNoHiddenLeak', () => {
  type SecretState = { secrets: number[] };
  const base = {
    ...(nim as unknown as GameDefinition<SecretState, NimMove, NimConfig>),
  };
  const state: SecretState = { secrets: [11, 22] };
  // Re-draw every secret the viewer is not allowed to see.
  const resample = (
    s: SecretState,
    viewer: Seat | 'spectator',
    rng: { int: (a: number, b: number) => number },
  ) => ({
    secrets: s.secrets.map((v, seat) => (seat === viewer ? v : rng.int(0, 1000))),
  });

  it('passes when each player only sees their own secret', () => {
    const good = {
      ...base,
      playerView: (s: SecretState, viewer: Seat | 'spectator') => ({
        mine: viewer === 'spectator' ? null : s.secrets[viewer],
        others: s.secrets.length - (viewer === 'spectator' ? 0 : 1),
      }),
    };
    expect(() => assertNoHiddenLeak(good, state, resample, { players: 2 })).not.toThrow();
  });

  it('fails when the view exposes another player secret', () => {
    const leaky = { ...base, playerView: (s: SecretState) => s };
    expect(() => assertNoHiddenLeak(leaky, state, resample, { players: 2 })).toThrow(
      /can see hidden information/,
    );
  });
});
