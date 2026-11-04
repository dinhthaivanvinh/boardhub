import { describe, expect, it } from 'vitest';
import { createRng, type Seat } from '@bg/engine';
import { playArena, randomMove, type BotLevel } from '@bg/bots';
import { randomPlayout } from '@bg/engine/testing';
import { bot, evaluate, orderMoves } from '../src/bot';
import { definition } from '../src/rules/definition';
import type { XiangqiState } from '../src/rules/types';
import { at, E, fromDiagram, play } from './helpers';

const LEVELS: BotLevel[] = ['easy', 'medium', 'hard'];

const choose = (state: XiangqiState, level: BotLevel, budgetMs = 400, seed = 'b') =>
  bot.chooseMove({
    state,
    seat: state.turn,
    level,
    rng: createRng(seed, 0),
    deadlineMs: Date.now() + budgetMs,
  });

describe('xiangqi bot', () => {
  it('always plays a legal move at every level', () => {
    const states: XiangqiState[] = [];
    randomPlayout(definition, {}, 'bot-states', 5_000, {
      eachStep: (s, ply) => {
        if (ply % 15 === 0 && ply <= 60 && !definition.result(s)) states.push(s);
      },
    });
    for (const s of states) {
      for (const level of LEVELS) {
        expect(definition.validateMove(s, s.turn, choose(s, level, 150))).toEqual({ ok: true });
      }
    }
  }, 60_000);

  it.each(['medium', 'hard'] as const)('%s delivers mate in one', (level) => {
    const s = fromDiagram(['....k....', 'R........', E, E, E, '........R', E, E, E, '...K.....'], 0);
    expect(choose(s, level, 1500)).toEqual({ from: at(5, 8), to: at(0, 8) });
  });

  it.each(['medium', 'hard'] as const)('%s takes a free chariot', (level) => {
    // The black chariot on the red horse's jump point is unprotected.
    // (The red general is off the black general's file, so it is not forced to move.)
    const s = fromDiagram(['....k....', E, E, E, E, E, E, '..r......', E, '.H.K.....'], 0);
    expect(choose(s, level, 1500)).toEqual({ from: at(9, 1), to: at(7, 2) });
  });

  it('orders captures of valuable pieces first', () => {
    const s = fromDiagram(['....k....', E, E, E, E, E, E, '..r.p....', E, '.H..K....'], 0);
    const ordered = orderMoves(s, definition.legalMoves!(s, 0));
    expect(ordered[0]).toEqual({ from: at(9, 1), to: at(7, 2) });
  });

  it('evaluate counts material for the right side', () => {
    const start = play([]);
    expect(evaluate(start, 0)).toBe(0);
    const upAChariot = fromDiagram(['....k....', E, E, E, E, E, E, E, E, 'R...K....'], 1);
    expect(evaluate(upAChariot, 0)).toBeGreaterThan(80);
    expect(evaluate(upAChariot, 1)).toBeLessThan(-80);
  });

  it('medium beats a random player', () => {
    const medium = (s: XiangqiState, seat: Seat) =>
      bot.chooseMove({
        state: s,
        seat,
        level: 'medium',
        rng: createRng('m', 0),
        deadlineMs: Date.now() + 80,
      });
    const random = (s: XiangqiState, seat: Seat, game: number, ply: number) =>
      randomMove(definition, s, seat, createRng(`r${game}`, ply));
    expect(playArena(definition, {}, [medium, random], 2).wins[0]).toBe(2);
  }, 120_000);
});
