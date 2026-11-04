import { describe, expect, it } from 'vitest';
import { createRng, runMove, setupMatch } from '@bg/engine';
import { countDiscs } from '../src/rules/board';
import { definition } from '../src/rules/definition';
import type { ReversiState } from '../src/rules/types';
import { at, EMPTY_ROW as E, fromDiagram, play } from './helpers';

const ctx = { rng: createRng('rv', 0) };

function move(state: ReversiState, cell: number) {
  const res = runMove(definition, state, state.turn, { cell }, ctx);
  if (!res.ok) throw new Error(res.code);
  return res;
}

describe('setup', () => {
  it('starts with the crossed centre and Black to move', () => {
    const { config, state } = setupMatch(definition, {}, 2, 's');
    expect(config).toEqual({ size: 8 });
    expect([
      state.board[at(3, 3)],
      state.board[at(3, 4)],
      state.board[at(4, 3)],
      state.board[at(4, 4)],
    ]).toEqual([1, 0, 0, 1]);
    expect(countDiscs(state.board)).toEqual([2, 2]);
    expect(definition.activePlayers(state)).toEqual([0]);
    expect(definition.legalMoves!(state, 0).map((m) => m.cell)).toEqual([
      at(2, 3),
      at(3, 2),
      at(4, 5),
      at(5, 4),
    ]);
  });

  it.each([6, 10])('supports %i x %i with four opening moves', (size) => {
    const { state } = setupMatch(definition, { size }, 2, 's');
    expect(state.board).toHaveLength(size * size);
    expect(definition.legalMoves!(state, 0)).toHaveLength(4);
  });

  it('rejects other sizes', () => {
    expect(() => setupMatch(definition, { size: 7 }, 2, 's')).toThrow();
  });
});

describe('moves', () => {
  it('flips the trapped disc and passes the turn', () => {
    const s = play([at(2, 3)]);
    expect(s.board[at(3, 3)]).toBe(0);
    expect(s).toMatchObject({ turn: 1, moveCount: 1, lastMove: at(2, 3), flipped: [at(3, 3)], passed: null });
    expect(countDiscs(s.board)).toEqual([4, 1]);
  });

  it('rejects occupied cells, cells off the board and moves that flip nothing', () => {
    const s = play([]);
    expect(definition.validateMove(s, 0, { cell: at(3, 3) })).toEqual({
      ok: false,
      code: 'reversi.cell_occupied',
    });
    expect(definition.validateMove(s, 0, { cell: 64 })).toEqual({ ok: false, code: 'reversi.out_of_bounds' });
    expect(definition.validateMove(s, 0, { cell: -1 })).toEqual({ ok: false, code: 'reversi.out_of_bounds' });
    expect(definition.validateMove(s, 0, { cell: 0 })).toEqual({ ok: false, code: 'reversi.no_flips' });
    expect(runMove(definition, s, 1, { cell: at(2, 3) }, ctx)).toMatchObject({
      code: 'engine.not_your_turn',
    });
  });

  it('flips every trapped line at once, but not lines left open', () => {
    const s = fromDiagram([E, '.B.B....', '..WW....', '.BW.W...', E, E, E, E], 0);
    const res = move(s, at(3, 3));
    expect([...res.state.flipped].sort((a, b) => a - b)).toEqual([at(2, 2), at(2, 3), at(3, 2)]);
    expect(res.state.board[at(3, 4)]).toBe(1); // open on the right: not flipped
  });

  it('a side with no legal move passes automatically', () => {
    const s = fromDiagram(['BW......', E, E, E, 'BWW.....', E, E, E], 0);
    const res = move(s, at(0, 2));
    expect(res.state).toMatchObject({ turn: 0, passed: 1, over: false });
    expect(definition.activePlayers(res.state)).toEqual([0]);
    expect(res.result).toBeNull();
    // Black keeps playing; the pass notice is cleared.
    expect(move(res.state, at(4, 3)).state.passed).toBeNull();
  });

  it('playerView shows everything to everyone', () => {
    const s = play([at(2, 3)]);
    for (const viewer of [0, 1, 'spectator'] as const) expect(definition.playerView(s, viewer)).toEqual(s);
  });
});

describe('end of the game', () => {
  it('ends early when neither side can move; most discs wins', () => {
    const res = move(fromDiagram(['BW......', E, E, E, E, E, E, E], 0), at(0, 2));
    expect(res.state.over).toBe(true);
    expect(res.result).toEqual({ kind: 'win', winners: [0], reason: 'more_discs' });
    expect(definition.activePlayers(res.state)).toEqual([]);
    expect(definition.legalMoves!(res.state, 1)).toEqual([]);
  });

  it('equal discs is a draw', () => {
    const res = move(fromDiagram(['BW......', E, E, E, E, E, E, 'WWW.....'], 0), at(0, 2));
    expect(res.result).toEqual({ kind: 'draw', reason: 'equal_discs' });
  });

  it('White can win', () => {
    const res = move(fromDiagram(['WB......', E, E, E, E, E, E, E], 1), at(0, 2));
    expect(res.result).toEqual({ kind: 'win', winners: [1], reason: 'more_discs' });
  });
});
