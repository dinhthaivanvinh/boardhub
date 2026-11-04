import { describe, expect, it } from 'vitest';
import { createRng, runMove, setupMatch } from '@bg/engine';
import { pseudoTargets } from '../src/rules/board';
import { definition } from '../src/rules/definition';
import { MOVE_LIMIT } from '../src/rules/rules';
import type { XiangqiState } from '../src/rules/types';
import { at, E, fromDiagram, play } from './helpers';

const ctx = { rng: createRng('xq', 0) };
const targets = (s: XiangqiState, from: number) => [...pseudoTargets(s.board, from)].sort((a, b) => a - b);
const legalTo = (s: XiangqiState, from: number) =>
  definition.legalMoves!(s, s.turn)
    .filter((m) => m.from === from)
    .map((m) => m.to)
    .sort((a, b) => a - b);

function move(state: XiangqiState, from: number, to: number) {
  const res = runMove(definition, state, state.turn, { from, to }, ctx);
  if (!res.ok) throw new Error(res.code);
  return res;
}

describe('setup', () => {
  it('places 32 pieces and Red has exactly 44 legal moves', () => {
    const { state } = setupMatch(definition, {}, 2, 's');
    expect(state.board.filter(Boolean)).toHaveLength(32);
    expect(state.board[at(9, 4)]).toBe('rK');
    expect(state.board[at(0, 4)]).toBe('bK');
    expect(state.board[at(7, 1)]).toBe('rC');
    expect(state.board[at(3, 8)]).toBe('bP');
    expect(definition.activePlayers(state)).toEqual([0]);
    expect(definition.legalMoves!(state, 0)).toHaveLength(44);
    expect(definition.legalMoves!(state, 1)).toHaveLength(44);
  });

  it('has no options', () => {
    expect(() => setupMatch(definition, { variant: 'x' }, 2, 's')).toThrow();
  });
});

describe('how pieces move', () => {
  it('the horse is blocked by a piece next to it (its leg)', () => {
    const free = fromDiagram([E, E, E, E, '....H....', E, E, E, E, E], 0);
    expect(targets(free, at(4, 4))).toHaveLength(8);
    const blocked = fromDiagram([E, E, E, '....P....', '....H....', E, E, E, E, E], 0);
    // The soldier above blocks both upward jumps.
    expect(targets(blocked, at(4, 4))).not.toContain(at(2, 3));
    expect(targets(blocked, at(4, 4))).not.toContain(at(2, 5));
    expect(targets(blocked, at(4, 4))).toHaveLength(6); // 8 jumps minus the 2 blocked upward ones
  });

  it('the elephant moves two points diagonally, cannot cross the river and is blocked at its eye', () => {
    const s = fromDiagram([E, E, E, E, E, '..E......', E, E, E, E], 0);
    expect(targets(s, at(5, 2))).toEqual([at(7, 0), at(7, 4)]); // (3,0) and (3,4) are across the river
    const blocked = fromDiagram([E, E, E, E, E, E, E, '..E......', '...P.....', E], 0);
    expect(targets(blocked, at(7, 2))).toEqual([at(5, 0), at(5, 4), at(9, 0)]);
  });

  it('general and advisors stay inside the palace', () => {
    const s = fromDiagram([E, E, E, E, E, E, E, '...K.....', '....A....', E], 0);
    expect(targets(s, at(7, 3))).toEqual([at(7, 4), at(8, 3)]);
    expect(targets(s, at(8, 4))).toEqual([at(7, 5), at(9, 3), at(9, 5)]);
  });

  it('the cannon slides without capturing and captures only by jumping one screen', () => {
    const s = fromDiagram([E, '....r....', E, '....p....', E, E, '....C....', E, E, E], 0);
    const t = targets(s, at(6, 4));
    expect(t).toContain(at(4, 4)); // slide
    expect(t).not.toContain(at(3, 4)); // the first piece is only a screen
    expect(t).toContain(at(1, 4)); // captured over the screen
    expect(t).not.toContain(at(0, 4));
  });

  it('the chariot slides until blocked and can capture', () => {
    const s = fromDiagram([E, E, E, E, '..p.R..P.', E, E, E, E, E], 0);
    const t = targets(s, at(4, 4));
    expect(t).toContain(at(4, 2)); // capture
    expect(t).not.toContain(at(4, 1));
    expect(t).not.toContain(at(4, 7)); // own piece
    expect(t).toContain(at(0, 4));
    expect(t).toContain(at(9, 4));
  });

  it('soldiers only move forward until they cross the river, then also sideways', () => {
    const before = fromDiagram([E, E, E, E, E, E, '....P....', E, E, E], 0);
    expect(targets(before, at(6, 4))).toEqual([at(5, 4)]);
    const after = fromDiagram([E, E, E, E, '....P....', E, E, E, E, E], 0);
    expect(targets(after, at(4, 4))).toEqual([at(3, 4), at(4, 3), at(4, 5)]);
    const black = fromDiagram([E, E, E, E, E, '....p....', E, E, E, E], 1);
    expect(targets(black, at(5, 4))).toEqual([at(5, 3), at(5, 5), at(6, 4)]);
  });
});

describe('legality', () => {
  it('rejects bad moves with specific codes', () => {
    const s = play([]);
    const check = (from: number, to: number) => definition.validateMove(s, 0, { from, to });
    expect(check(-1, 0)).toEqual({ ok: false, code: 'xiangqi.out_of_bounds' });
    expect(check(at(9, 0), 90)).toEqual({ ok: false, code: 'xiangqi.out_of_bounds' });
    expect(check(at(5, 0), at(4, 0))).toEqual({ ok: false, code: 'xiangqi.no_piece' });
    expect(check(at(0, 0), at(1, 0))).toEqual({ ok: false, code: 'xiangqi.not_your_piece' });
    expect(check(at(9, 0), at(8, 1))).toEqual({ ok: false, code: 'xiangqi.illegal_move' });
  });

  it('the generals may not face each other on an open file', () => {
    // The red advisor is the only piece between the generals; moving it away is illegal.
    const s = fromDiagram(['....k....', E, E, E, E, E, E, E, '....A....', '....K....'], 0);
    expect(definition.validateMove(s, 0, { from: at(8, 4), to: at(7, 3) })).toEqual({
      ok: false,
      code: 'xiangqi.self_check',
    });
  });

  it('you may not leave your general in check', () => {
    const s = fromDiagram(['...k.....', E, E, E, E, E, E, E, '....r....', '....K..R.'], 0);
    expect(definition.validateMove(s, 0, { from: at(9, 7), to: at(8, 7) })).toEqual({
      ok: false,
      code: 'xiangqi.self_check',
    });
    // Capturing the attacker or stepping aside is fine.
    // (9,3) would face the black general on an open file.
    expect(legalTo(s, at(9, 4))).toEqual([at(8, 4), at(9, 5)]);
  });

  it('records captures and check', () => {
    const s = fromDiagram(['...k.....', E, E, E, E, E, E, E, E, '...R.K...'], 0);
    const res = move(s, at(9, 3), at(0, 3));
    expect(res.state.captured).toEqual(['bK']);
    const s2 = fromDiagram(['....k....', E, E, E, E, E, E, E, E, '...K...R.'], 0);
    expect(move(s2, at(9, 7), at(9, 8)).state.inCheck).toBeNull();
    // Chariot to Black's back rank: check along the rank.
    expect(move(s2, at(9, 7), at(0, 7)).state.inCheck).toBe(1);
  });

  it('playerView shows everything to everyone', () => {
    const s = play([[at(7, 1), at(7, 4)]]);
    for (const viewer of [0, 1, 'spectator'] as const) expect(definition.playerView(s, viewer)).toEqual(s);
  });
});

describe('end of the game', () => {
  it('checkmate: two chariots trap the black general', () => {
    const s = fromDiagram(['....k....', 'R........', E, E, E, '........R', E, E, E, '...K.....'], 0);
    const res = move(s, at(5, 8), at(0, 8));
    expect(res.state.inCheck).toBe(1);
    expect(res.result).toEqual({ kind: 'win', winners: [0], reason: 'checkmate' });
    expect(definition.activePlayers(res.state)).toEqual([]);
    expect(definition.legalMoves!(res.state, 1)).toEqual([]);
  });

  it('a side with no legal move loses even when not in check (stalemate)', () => {
    const s = fromDiagram(['...k.....', '........R', E, E, E, '........R', E, E, E, '.....K...'], 0);
    const res = move(s, at(5, 8), at(5, 4));
    expect(res.state.inCheck).toBeNull();
    expect(res.result).toEqual({ kind: 'win', winners: [0], reason: 'stalemate' });
  });

  it('the same position three times is a draw', () => {
    const shuffle: [number, number][] = [
      [at(9, 1), at(7, 2)],
      [at(0, 1), at(2, 2)],
      [at(7, 2), at(9, 1)],
      [at(2, 2), at(0, 1)],
    ];
    const once = play(shuffle);
    expect(definition.result(once)).toBeNull(); // the start position has now been seen twice
    const twice = play([...shuffle, ...shuffle]);
    expect(definition.result(twice)).toEqual({ kind: 'draw', reason: 'repetition' });
  });

  it(`${MOVE_LIMIT} plies without a capture is a draw`, () => {
    const s = { ...play([]), sinceCapture: MOVE_LIMIT - 1 };
    expect(move(s, at(9, 1), at(7, 2)).result).toEqual({ kind: 'draw', reason: 'move_limit' });
  });

  it('a capture resets the counters', () => {
    const s = {
      ...fromDiagram(['....k....', E, E, E, '....p....', E, E, E, E, '...KR....'], 0),
      sinceCapture: 50,
    };
    // Red chariot takes the soldier on the file (the black general is behind it, so no check issue).
    const next = move(s, at(9, 4), at(4, 4)).state;
    expect(next.sinceCapture).toBe(0);
    expect(next.positions).toHaveLength(1);
  });
});
