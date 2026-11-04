import { describe, expect, it } from 'vitest';
import { createRng, type Seat } from '@bg/engine';
import { playArena, randomMove, type BotLevel } from '@bg/bots';
import { randomPlayout } from '@bg/engine/testing';
import { bot, evaluate, orderMoves } from '../src/bot';
import { definition } from '../src/rules/definition';
import type { FourState } from '../src/rules/types';
import { drops, fromDiagram } from './helpers';

const config = definition.configSchema.parse({});
const LEVELS: BotLevel[] = ['easy', 'medium', 'hard'];

const choose = (state: FourState, level: BotLevel, budgetMs = 300, seed = 'b') =>
  bot.chooseMove({
    state,
    seat: state.turn,
    level,
    rng: createRng(seed, 0),
    deadlineMs: Date.now() + budgetMs,
  });

describe('four-in-a-row bot', () => {
  it('always plays a legal move at every level', () => {
    const states: FourState[] = [];
    randomPlayout(definition, config, 'bot-states', 42, {
      eachStep: (s, ply) => {
        if (ply % 5 === 0 && !definition.result(s)) states.push(s);
      },
    });
    for (const s of states) {
      for (const level of LEVELS) {
        expect(definition.validateMove(s, s.turn, choose(s, level, 100))).toEqual({ ok: true });
      }
    }
  });

  it.each(['medium', 'hard'] as const)('%s opens in the centre', (level) => {
    expect(choose(drops([]), level)).toEqual({ col: 3 });
  });

  it.each(['medium', 'hard'] as const)('%s takes an immediate win', (level) => {
    // Yellow has three stacked in column 0 and Red would win next turn in column 6.
    const s = drops([0, 6, 0, 6, 0, 6]);
    expect(choose(s, level)).toEqual({ col: 0 });
  });

  it.each(['medium', 'hard'] as const)('%s blocks an immediate loss', (level) => {
    // Red threatens to complete the bottom row at column 3; Yellow has nothing better.
    const s = fromDiagram(['.......', '.......', '.......', '.......', '.......', 'RRR.Y.Y'], 0);
    expect(choose(s, level)).toEqual({ col: 3 });
  });

  it('orders wins first, then blocks, then centre columns', () => {
    const s = fromDiagram(['.......', '.......', '.......', 'Y......', 'Y.....R', 'Y.....R'], 1);
    // Red to move: col 6 is not a win yet (two), col 0 blocks Yellow.
    expect(orderMoves(s, definition.legalMoves!(s, 1), 1)[0]).toEqual({ col: 0 });
    const order = orderMoves(drops([]), definition.legalMoves!(drops([]), 0), 0).map((m) => m.col);
    expect(order).toEqual([3, 2, 4, 1, 5, 0, 6]);
  });

  it('evaluate favours the side with better lines', () => {
    const s = fromDiagram(['.......', '.......', '.......', '.......', '.......', '..YYY..'], 1);
    expect(evaluate(s, 0)).toBeGreaterThan(0);
    expect(evaluate(s, 1)).toBeLessThan(0);
  });

  it('is reproducible with the same seed on easy', () => {
    const s = drops([3, 3]);
    expect(choose(s, 'easy', 200, 'same')).toEqual(choose(s, 'easy', 200, 'same'));
  });

  it('medium beats a random player', () => {
    const medium = (s: FourState, seat: Seat) =>
      bot.chooseMove({
        state: s,
        seat,
        level: 'medium',
        rng: createRng('m', 0),
        deadlineMs: Date.now() + 100,
      });
    const random = (s: FourState, seat: Seat, game: number, ply: number) =>
      randomMove(definition, s, seat, createRng(`r${game}`, ply));
    expect(playArena(definition, {}, [medium, random], 6).wins[0]).toBe(6);
  });

  it('hard beats easy', () => {
    const player = (level: BotLevel) => (s: FourState, seat: Seat, game: number, ply: number) =>
      bot.chooseMove({
        state: s,
        seat,
        level,
        rng: createRng(`${level}-${game}`, ply),
        deadlineMs: Date.now() + 150,
      });
    const stats = playArena(definition, {}, [player('hard'), player('easy')], 4);
    expect(stats.wins[0]).toBeGreaterThanOrEqual(3);
  });
});
