import { describe, expect, it } from 'vitest';
import { createRng, type Seat } from '@bg/engine';
import { playArena, randomMove, type BotLevel } from '@bg/bots';
import { randomPlayout } from '@bg/engine/testing';
import { bot, evaluate, orderMoves } from '../src/bot';
import { weightsFor } from '../src/bot/evaluate';
import { definition } from '../src/rules/definition';
import type { ReversiState } from '../src/rules/types';
import { at, EMPTY_ROW as E, fromDiagram, play } from './helpers';

const config = definition.configSchema.parse({});
const LEVELS: BotLevel[] = ['easy', 'medium', 'hard'];

const choose = (state: ReversiState, level: BotLevel, budgetMs = 300, seed = 'b') =>
  bot.chooseMove({
    state,
    seat: state.turn,
    level,
    rng: createRng(seed, 0),
    deadlineMs: Date.now() + budgetMs,
  });

describe('reversi bot', () => {
  it('always plays a legal move at every level', () => {
    const states: ReversiState[] = [];
    randomPlayout(definition, config, 'bot-states', 64, {
      eachStep: (s, ply) => {
        if (ply % 8 === 0 && !definition.result(s)) states.push(s);
      },
    });
    for (const s of states) {
      for (const level of LEVELS) {
        expect(definition.validateMove(s, s.turn, choose(s, level, 100))).toEqual({ ok: true });
      }
    }
  });

  it.each(['medium', 'hard'] as const)('%s takes a free corner', (level) => {
    const s = fromDiagram(['.WB.....', E, E, '...WB...', '...BW...', E, E, E], 0);
    expect(choose(s, level)).toEqual({ cell: at(0, 0) });
  });

  it('corners weigh most and the squares next to them least', () => {
    const w = weightsFor(8);
    expect(w[at(0, 0)]).toBe(100);
    expect(w[at(1, 1)]).toBe(-50);
    expect(w[at(0, 1)]).toBe(-20);
    expect(w[at(0, 3)]).toBe(10);
    expect(orderMoves(play([]), [{ cell: at(1, 1) }, { cell: at(0, 0) }, { cell: at(3, 2) }])[0]).toEqual({
      cell: at(0, 0),
    });
  });

  it('evaluate favours the side with the corners and counts discs at the end', () => {
    const s = fromDiagram(['B......B', E, E, '...WB...', '...BW...', E, E, 'B......B'], 1);
    expect(evaluate(s, 0)).toBeGreaterThan(evaluate(s, 1));
    const nearlyFull = fromDiagram(
      Array.from({ length: 8 }, (_, r) => (r < 5 ? 'BBBBBBBB' : 'WWWWWW..')),
      0,
    );
    expect(evaluate(nearlyFull, 0)).toBe((40 - 18) * 10);
  });

  it('medium beats a random player', () => {
    const medium = (s: ReversiState, seat: Seat) =>
      bot.chooseMove({
        state: s,
        seat,
        level: 'medium',
        rng: createRng('m', 0),
        deadlineMs: Date.now() + 100,
      });
    const random = (s: ReversiState, seat: Seat, game: number, ply: number) =>
      randomMove(definition, s, seat, createRng(`r${game}`, ply));
    expect(playArena(definition, {}, [medium, random], 4).wins[0]).toBe(4);
    // Whole games with a thinking bot: generous timeout for busy CI machines.
  }, 30_000);
});
