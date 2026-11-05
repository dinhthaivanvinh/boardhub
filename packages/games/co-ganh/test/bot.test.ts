import { describe, expect, it } from 'vitest';
import { createRng, type Seat } from '@bg/engine';
import { playArena, randomMove, type BotLevel } from '@bg/bots';
import { randomPlayout } from '@bg/engine/testing';
import { bot, evaluate, orderMoves } from '../src/bot';
import { definition } from '../src/rules/definition';
import type { CoGanhState } from '../src/rules/types';
import { at, fromDiagram, play } from './helpers';

const LEVELS: BotLevel[] = ['easy', 'medium', 'hard'];

const choose = (state: CoGanhState, level: BotLevel, budgetMs = 400, seed = 'b') =>
  bot.chooseMove({
    state,
    seat: state.turn,
    level,
    rng: createRng(seed, 0),
    deadlineMs: Date.now() + budgetMs,
  });

describe('co-ganh bot', () => {
  it('always plays a legal move at every level', () => {
    const states: CoGanhState[] = [];
    randomPlayout(definition, {}, 'bot-states', 2_000, {
      eachStep: (s, ply) => {
        if (ply % 8 === 0 && ply <= 40 && !definition.result(s)) states.push(s);
      },
    });
    for (const s of states) {
      for (const level of LEVELS) {
        expect(definition.validateMove(s, s.turn, choose(s, level, 120))).toEqual({ ok: true });
      }
    }
  }, 60_000);

  it.each(['medium', 'hard'] as const)('%s carries when it can', (level) => {
    const s = fromDiagram(['B...B', '.....', 'B.B..', '.R...', 'R....'], 0);
    expect(choose(s, level, 800)).toEqual({ from: at(3, 1), to: at(2, 1) });
  });

  it('orders the biggest capture first', () => {
    const s = fromDiagram(['B.B..', '..R..', 'B.B..', '.R...', '.....'], 0);
    expect(orderMoves(s, definition.legalMoves!(s, 0))[0]).toEqual({ from: at(1, 2), to: at(1, 1) });
  });

  it('evaluate is symmetric at the start and counts pieces', () => {
    expect(evaluate(play([]), 0)).toBe(0);
    const ahead = fromDiagram(['B....', '.....', '..R..', '.R.R.', '.....'], 0);
    expect(evaluate(ahead, 0)).toBeGreaterThan(150);
    expect(evaluate(ahead, 1)).toBeLessThan(-150);
  });

  it('medium beats a random player', () => {
    const medium = (s: CoGanhState, seat: Seat) =>
      bot.chooseMove({
        state: s,
        seat,
        level: 'medium',
        rng: createRng('m', 0),
        deadlineMs: Date.now() + 60,
      });
    const random = (s: CoGanhState, seat: Seat, game: number, ply: number) =>
      randomMove(definition, s, seat, createRng(`r${game}`, ply));
    expect(playArena(definition, {}, [medium, random], 4).wins[0]).toBeGreaterThanOrEqual(3);
  }, 120_000);
});
