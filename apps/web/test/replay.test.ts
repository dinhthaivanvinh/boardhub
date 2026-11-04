import { describe, expect, it } from 'vitest';
import { definition as caro } from '@bg/game-caro/rules';
import { definition as xiangqi } from '@bg/game-xiangqi/rules';
import { buildReplay, outcomeFor } from '../src/game-runtime/replay';

const players = [
  { seat: 0, userId: 'a', name: 'A', botLevel: null },
  { seat: 1, userId: null, name: null, botLevel: 'easy' },
];

describe('buildReplay', () => {
  it('rebuilds every position of a match, start included', () => {
    const cells = [108, 0, 109, 2, 110, 4, 111, 6, 112];
    const states = buildReplay(caro, {
      config: {},
      players,
      seed: 's',
      moves: cells.map((cell, i) => ({ seat: i % 2, move: { cell } })),
    }) as { moveCount: number; winner: number | null }[];
    expect(states).toHaveLength(10);
    expect(states[0]!.moveCount).toBe(0);
    expect(states.at(-1)).toMatchObject({ moveCount: 9, winner: 0 });
  });

  it('works for a game without options', () => {
    const states = buildReplay(xiangqi, {
      config: {},
      players,
      seed: 's',
      moves: [{ seat: 0, move: { from: 64, to: 67 } }],
    });
    expect(states).toHaveLength(2);
  });

  it('fails loudly on a move the rules reject (e.g. rules changed since)', () => {
    expect(() =>
      buildReplay(caro, { config: {}, players, seed: 's', moves: [{ seat: 1, move: { cell: 0 } }] }),
    ).toThrow(/move 0 cannot be replayed: engine.not_your_turn/);
  });
});

describe('outcomeFor', () => {
  it('reads the result from the player point of view', () => {
    const win = { kind: 'win' as const, winners: [0], reason: 'x' };
    expect(outcomeFor({ result: win, players }, 'a')).toBe('win');
    expect(outcomeFor({ result: { ...win, winners: [1] }, players }, 'a')).toBe('loss');
    expect(outcomeFor({ result: { kind: 'draw', reason: 'x' }, players }, 'a')).toBe('draw');
    expect(outcomeFor({ result: null, players }, 'a')).toBe('playing');
  });
});
