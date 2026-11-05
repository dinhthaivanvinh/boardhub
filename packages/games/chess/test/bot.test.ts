import { describe, expect, it } from 'vitest';
import { createRng, type Seat } from '@bg/engine';
import { playArena, randomMove, type BotLevel } from '@bg/bots';
import { bot, evaluate, orderMoves } from '../src/bot';
import { definition } from '../src/rules/definition';
import { setup } from '../src/rules/rules';
import type { ChessState } from '../src/rules/types';
import { fen, play, s } from './helpers';

const choose = (state: ChessState, level: BotLevel, budgetMs = 1500) =>
  bot.chooseMove({
    state,
    seat: state.turn,
    level,
    rng: createRng('b', 0),
    deadlineMs: Date.now() + budgetMs,
  });

describe('chess bot', () => {
  it('plays legal moves at every level', () => {
    const positions = [setup({}), play(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'])];
    for (const st of positions) {
      for (const level of ['easy', 'medium', 'hard'] as const) {
        expect(definition.validateMove(st, st.turn, choose(st, level, 300))).toEqual({ ok: true });
      }
    }
  }, 60_000);

  it.each(['medium', 'hard'] as const)(
    '%s finds mate in one',
    (level) => {
      // Back-rank mate: Ra1-a8.
      const st = fen('6k1/5ppp/8/8/8/8/8/R5K1 w - -');
      expect(choose(st, level)).toEqual({ from: s('a1'), to: s('a8') });
    },
    30_000,
  );

  it.each(['medium', 'hard'] as const)(
    '%s takes a free queen',
    (level) => {
      const st = fen('4k3/8/8/3q4/8/2N5/8/4K3 w - -');
      expect(choose(st, level)).toEqual({ from: s('c3'), to: s('d5') });
    },
    30_000,
  );

  it('orders big captures first and counts material for the right side', () => {
    const st = fen('4k3/8/8/3q4/8/2N5/8/4K3 w - -');
    expect(orderMoves(st, definition.legalMoves!(st, 0))[0]).toEqual({ from: s('c3'), to: s('d5') });
    expect(evaluate(setup({}), 0)).toBe(0);
    expect(evaluate(st, 1)).toBeGreaterThan(500);
    expect(evaluate(st, 0)).toBeLessThan(-500);
  });

  it('medium beats a random player', () => {
    const medium = (st: ChessState, seat: Seat) =>
      bot.chooseMove({
        state: st,
        seat,
        level: 'medium',
        rng: createRng('m', 0),
        deadlineMs: Date.now() + 120,
      });
    const random = (st: ChessState, seat: Seat, game: number, ply: number) =>
      randomMove(definition, st, seat, createRng(`r${game}`, ply));
    const { wins } = playArena(definition, {}, [medium, random], 2);
    expect(wins[0]).toBeGreaterThanOrEqual(1);
  }, 180_000);
});
