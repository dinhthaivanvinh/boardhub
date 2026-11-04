import { describe, expect, it } from 'vitest';
import { createRng, runMove, type Seat } from '@bg/engine';
import { playArena, randomMove, type BotLevel } from '@bg/bots';
import { randomPlayout } from '@bg/engine/testing';
import { bot, candidateMoves, evaluate } from '../src/bot';
import { definition } from '../src/rules/definition';
import type { CaroState } from '../src/rules/types';
import { at, play } from './helpers';

const config = definition.configSchema.parse({});
const LEVELS: BotLevel[] = ['easy', 'medium', 'hard'];

const choose = (state: CaroState, level: BotLevel, budgetMs = 300, seed = 'b') =>
  bot.chooseMove({
    state,
    seat: state.turn,
    level,
    rng: createRng(seed, 0),
    deadlineMs: Date.now() + budgetMs,
  });

describe('caro bot', () => {
  it('opens in the centre', () => {
    const empty = play({}, [], []);
    expect(candidateMoves(empty)).toEqual([{ cell: at(7, 7) }]);
    expect(choose(empty, 'hard')).toEqual({ cell: at(7, 7) });
  });

  it('only considers cells near existing pieces', () => {
    const s = play({}, [at(0, 0)], []);
    expect(
      candidateMoves(s)
        .map((m) => m.cell)
        .sort((a, b) => a - b),
    ).toEqual(
      [at(0, 1), at(0, 2), at(1, 0), at(1, 1), at(1, 2), at(2, 0), at(2, 1), at(2, 2)].sort((a, b) => a - b),
    );
  });

  it('always plays a legal move at every level', () => {
    const states: CaroState[] = [];
    randomPlayout(definition, config, 'bot-states', 225, {
      eachStep: (s, ply) => {
        if (ply % 9 === 0 && !definition.result(s)) states.push(s);
      },
    });
    for (const s of states.slice(0, 8)) {
      for (const level of LEVELS) {
        const move = choose(s, level, 100);
        expect(definition.validateMove(s, s.turn, move)).toEqual({ ok: true });
      }
    }
  });

  it.each(['medium', 'hard'] as const)('%s takes an immediate win', (level) => {
    const s = play({}, [at(7, 3), at(7, 4), at(7, 5), at(7, 6)], [at(0, 0), at(0, 2), at(0, 4), at(0, 6)]);
    const move = choose(s, level);
    const res = runMove(definition, s, 0, move, { rng: createRng('w', 0) });
    expect(res.ok && res.result).toMatchObject({ kind: 'win', winners: [0] });
  });

  it.each(['medium', 'hard'] as const)('%s blocks the opponent four', (level) => {
    // X blocks the left end; O has four and threatens (7,7). X has nothing better.
    const s = play({}, [at(7, 2), at(14, 0), at(14, 4), at(14, 8)], [at(7, 3), at(7, 4), at(7, 5), at(7, 6)]);
    expect(choose(s, level)).toEqual({ cell: at(7, 7) });
  });

  it('prefers its own position: evaluate rewards its lines and punishes the opponent', () => {
    const mine = play({}, [at(7, 7), at(7, 8), at(7, 9)], [at(0, 0), at(0, 14)]);
    expect(evaluate(mine, 0)).toBeGreaterThan(0);
    expect(evaluate(mine, 1)).toBeLessThan(0);
  });

  it('is reproducible with the same seed on easy (noise uses the rng)', () => {
    const s = play({}, [at(7, 7)], [at(7, 8)]);
    expect(choose(s, 'easy', 200, 'same')).toEqual(choose(s, 'easy', 200, 'same'));
  });

  it('medium beats a random player', () => {
    const medium = (s: CaroState, seat: Seat) =>
      bot.chooseMove({
        state: s,
        seat,
        level: 'medium',
        rng: createRng('m', 0),
        deadlineMs: Date.now() + 100,
      });
    const random = (s: CaroState, seat: Seat, game: number, ply: number) =>
      randomMove(definition, s, seat, createRng(`r${game}`, ply));
    const stats = playArena(definition, {}, [medium, random], 4);
    expect(stats.wins[0]).toBe(4);
  });
});
