import { describe, expect, it } from 'vitest';
import { createRng, type Seat } from '@bg/engine';
import { playArena, randomMove, type BotLevel } from '@bg/bots';
import { playMoves, randomPlayout } from '@bg/engine/testing';
import { bot, evaluate } from '../src/bot';
import { definition } from '../src/rules/definition';
import type { OAnQuanState } from '../src/rules/types';
import { position } from './helpers';

const LEVELS: BotLevel[] = ['easy', 'medium', 'hard'];

const choose = (state: OAnQuanState, level: BotLevel, budgetMs = 400, seed = 'b') =>
  bot.chooseMove({
    state,
    seat: state.turn,
    level,
    rng: createRng(seed, 0),
    deadlineMs: Date.now() + budgetMs,
  });

describe('o-an-quan bot', () => {
  it('always plays a legal move at every level', () => {
    const states: OAnQuanState[] = [];
    randomPlayout(definition, {}, 'bot-states', 2_000, {
      eachStep: (s, ply) => {
        if (ply % 6 === 0 && ply <= 36 && !definition.result(s)) states.push(s);
      },
    });
    for (const s of states) {
      for (const level of LEVELS) {
        expect(definition.validateMove(s, s.turn, choose(s, level, 120))).toEqual({ ok: true });
      }
    }
  }, 60_000);

  it.each(['medium', 'hard'] as const)('%s takes the last quan to win', (level) => {
    // Square 3 to the right: 4, then the empty 5, so the right quan square is taken and the game is won.
    // To the left it lands on 2 before the empty, already-taken left quan square: nothing.
    const s = position([0, 0, 0, 1, 0, 0, 0, 5, 5, 5, 5, 5], {
      quan: [false, true],
      stash: [
        { dan: 20, quan: 1 },
        { dan: 0, quan: 0 },
      ],
    });
    expect(choose(s, level, 800)).toEqual({ cell: 3, dir: 1 });
  });

  it('evaluate is even at the start and counts captured quan', () => {
    expect(evaluate(playMoves(definition, {}, []), 0)).toBe(0);
    const ahead = position([0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1], {
      quan: [true, false],
      stash: [
        { dan: 5, quan: 1 },
        { dan: 0, quan: 0 },
      ],
    });
    expect(evaluate(ahead, 0)).toBe(15);
    expect(evaluate(ahead, 1)).toBe(-15);
  });

  it('medium beats a random player', () => {
    const medium = (s: OAnQuanState, seat: Seat) =>
      bot.chooseMove({
        state: s,
        seat,
        level: 'medium',
        rng: createRng('m', 0),
        deadlineMs: Date.now() + 60,
      });
    const random = (s: OAnQuanState, seat: Seat, game: number, ply: number) =>
      randomMove(definition, s, seat, createRng(`r${game}`, ply));
    expect(playArena(definition, {}, [medium, random], 4).wins[0]).toBeGreaterThanOrEqual(3);
  }, 120_000);
});
