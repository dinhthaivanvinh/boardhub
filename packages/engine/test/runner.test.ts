import { describe, expect, it } from 'vitest';
import { createRng, InvalidMatchError, replayMatch, runMove, setupMatch, stableStringify } from '../src';
import { nim } from './nim';

const ctx = { rng: createRng('t', 0) };

describe('setupMatch', () => {
  it('fills config defaults and uses the seed', () => {
    const a = setupMatch(nim, {}, 2, 's1');
    expect(a.config).toEqual({ minPile: 10, maxPile: 20 });
    expect(setupMatch(nim, {}, 2, 's1').state).toEqual(a.state);
  });

  it('rejects a bad player count or config', () => {
    expect(() => setupMatch(nim, {}, 1, 's')).toThrow(InvalidMatchError);
    expect(() => setupMatch(nim, {}, 4, 's')).toThrow(/2-3 players/);
    expect(() => setupMatch(nim, { minPile: 'x' }, 2, 's')).toThrow(InvalidMatchError);
    expect(() => setupMatch(nim, { extra: 1 }, 2, 's')).toThrow(InvalidMatchError);
  });
});

describe('runMove', () => {
  const start = { pile: 5, turn: 0, players: 2, lastTaker: null };

  it('applies a valid move', () => {
    const res = runMove(nim, start, 0, { take: 2 }, ctx);
    expect(res).toEqual({ ok: true, state: { pile: 3, turn: 1, players: 2, lastTaker: 0 }, result: null });
  });

  it('rejects a move from a seat that is not active', () => {
    expect(runMove(nim, start, 1, { take: 1 }, ctx)).toEqual({ ok: false, code: 'engine.not_your_turn' });
  });

  it('rejects a badly shaped move before calling the rules', () => {
    expect(runMove(nim, start, 0, { take: '1' }, ctx)).toEqual({
      ok: false,
      code: 'engine.invalid_move_shape',
    });
    expect(runMove(nim, start, 0, null, ctx)).toEqual({ ok: false, code: 'engine.invalid_move_shape' });
  });

  it('passes through the game rejection code', () => {
    expect(runMove(nim, start, 0, { take: 4 }, ctx)).toEqual({ ok: false, code: 'nim.bad_take' });
  });

  it('reports the result and refuses moves after the game ends', () => {
    const res = runMove(nim, { ...start, pile: 2 }, 0, { take: 2 }, ctx);
    expect(res.ok && res.result).toEqual({ kind: 'win', winners: [0], reason: 'last_stone' });
    if (!res.ok) throw new Error('expected ok');
    expect(runMove(nim, res.state, 1, { take: 1 }, ctx)).toEqual({ ok: false, code: 'engine.game_over' });
  });
});

describe('replayMatch', () => {
  it('rebuilds the same state as playing live', () => {
    const { state: s0 } = setupMatch(nim, {}, 2, 'replay');
    const moves = [
      { seat: 0, move: { take: 3 } },
      { seat: 1, move: { take: 1 } },
      { seat: 0, move: { take: 2 } },
    ];
    let live = s0;
    moves.forEach(({ seat, move }, i) => {
      const res = runMove(nim, live, seat, move, { rng: createRng('replay', i) });
      if (!res.ok) throw new Error(res.code);
      live = res.state;
    });
    expect(replayMatch(nim, {}, 2, 'replay', moves)).toEqual(live);
  });

  it('throws with the rejection code when a recorded move is invalid', () => {
    expect(() => replayMatch(nim, {}, 2, 'replay', [{ seat: 1, move: { take: 1 } }])).toThrow(
      expect.objectContaining({ code: 'engine.not_your_turn' }),
    );
  });
});

describe('stableStringify', () => {
  it('ignores key order', () => {
    expect(stableStringify({ b: 1, a: { d: [1, { y: 1, x: 2 }], c: null } })).toBe(
      stableStringify({ a: { c: null, d: [1, { x: 2, y: 1 }] }, b: 1 }),
    );
  });
});
