import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRng, type Seat } from '@bg/engine';
import { createBot, iterativeDeepening, playArena, randomMove, terminalScore, WIN_SCORE } from '../src';
import { board, evaluate, ttt, type TttState } from './tictactoe';

const bot = createBot({
  id: 'ttt.test',
  def: ttt,
  evaluate,
  levels: {
    easy: { algo: 'random' },
    medium: { algo: 'greedy', timeMs: 1000 },
    hard: { algo: 'minimax', timeMs: 5000 },
  },
});

const choose = (state: TttState, level: 'easy' | 'medium' | 'hard', seed = 's') =>
  bot.chooseMove({ state, seat: state.turn, level, rng: createRng(seed, 0), deadlineMs: Date.now() + 5000 });

afterEach(() => vi.restoreAllMocks());

describe('randomMove', () => {
  it('returns a legal move and is reproducible with the same seed', () => {
    const s = board('XO.|...|...', 0);
    const a = randomMove(ttt, s, 0, createRng('r', 1));
    expect(ttt.validateMove(s, 0, a).ok).toBe(true);
    expect(randomMove(ttt, s, 0, createRng('r', 1))).toEqual(a);
  });

  it('throws when there is nothing to play', () => {
    expect(() => randomMove(ttt, board('XOX|XOO|OXX', 0), 0, createRng('r', 0))).toThrow(/no legal moves/);
  });
});

describe('minimax', () => {
  it('takes an immediate win', () => {
    expect(choose(board('XX.|OO.|...', 0), 'hard')).toEqual({ cell: 2 });
  });

  it('blocks an immediate loss', () => {
    expect(choose(board('X..|OO.|X..', 0), 'hard')).toEqual({ cell: 5 });
  });

  it('prefers the faster win', () => {
    // X can win now at 2, or later. It must win now.
    expect(choose(board('XX.|O..|O..', 0), 'hard')).toEqual({ cell: 2 });
  });

  it('perfect play against itself is always a draw', () => {
    const hard = (s: TttState, seat: Seat) =>
      bot.chooseMove({
        state: s,
        seat,
        level: 'hard',
        rng: createRng('p', 0),
        deadlineMs: Date.now() + 5000,
      });
    expect(playArena(ttt, {}, [hard, hard], 2)).toEqual({ wins: [0, 0], draws: 2 });
  });

  it('never loses to a random player', () => {
    const hard = (s: TttState, seat: Seat) =>
      bot.chooseMove({
        state: s,
        seat,
        level: 'hard',
        rng: createRng('h', 0),
        deadlineMs: Date.now() + 5000,
      });
    const random = (s: TttState, seat: Seat, game: number, ply: number) =>
      randomMove(ttt, s, seat, createRng(`rand-${game}`, ply));
    const stats = playArena(ttt, {}, [hard, random], 30);
    expect(stats.wins[1]).toBe(0);
    expect(stats.wins[0]).toBeGreaterThan(15);
  });

  it('stops at the deadline and still returns a legal move', () => {
    let t = 0;
    const now = () => (t += 10); // every clock read moves time forward 10ms
    const s = board('...|...|...', 0);
    const move = bot.chooseMove({
      state: s,
      seat: 0,
      level: 'hard',
      rng: createRng('d', 0),
      deadlineMs: 0,
      now,
    });
    expect(ttt.validateMove(s, 0, move).ok).toBe(true);
  });

  it('returns the first candidate when even depth 1 cannot finish', () => {
    const found = iterativeDeepening(ttt, { evaluate }, board('XX.|OO.|...', 0), 0, {
      maxDepth: 9,
      deadlineMs: 0,
      now: () => 1,
      ctx: { rng: createRng('x', 0) },
    });
    expect(found).toMatchObject({ move: { cell: 2 }, depth: 0 });
  });

  it('stops deepening once the whole tree is searched', () => {
    const found = iterativeDeepening(ttt, { evaluate }, board('XOX|OXO|O..', 0), 0, {
      maxDepth: 64,
      deadlineMs: Infinity,
      now: () => 0,
      ctx: { rng: createRng('x', 0) },
    });
    expect(found.depth).toBeLessThanOrEqual(3);
  });

  it('greedy looks one move ahead', () => {
    expect(choose(board('XX.|OO.|...', 0), 'medium')).toEqual({ cell: 2 });
  });
});

describe('createBot safety (rule B3)', () => {
  it('falls back to a random legal move when evaluate throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = createBot({
      id: 'broken',
      def: ttt,
      evaluate: () => {
        throw new Error('boom');
      },
      levels: { hard: { algo: 'minimax', timeMs: 100 } },
    });
    const s = board('X..|...|...', 1);
    const move = broken.chooseMove({
      state: s,
      seat: 1,
      level: 'hard',
      rng: createRng('b', 0),
      deadlineMs: Date.now() + 100,
    });
    expect(ttt.validateMove(s, 1, move).ok).toBe(true);
    expect(console.error).toHaveBeenCalled();
  });

  it('falls back when candidateMoves returns an illegal move', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = createBot({
      id: 'illegal',
      def: ttt,
      evaluate,
      candidateMoves: () => [{ cell: 0 }],
      levels: { hard: { algo: 'minimax', timeMs: 100 } },
    });
    const s = board('X..|...|...', 1);
    expect(
      broken.chooseMove({
        state: s,
        seat: 1,
        level: 'hard',
        rng: createRng('b', 0),
        deadlineMs: Date.now() + 100,
      }).cell,
    ).not.toBe(0);
  });

  it('uses the first configured level when the requested one is missing', () => {
    const onlyEasy = createBot({ id: 'easy-only', def: ttt, levels: { easy: { algo: 'random' } } });
    expect(onlyEasy.levels).toEqual(['easy']);
    const s = board('...|...|...', 0);
    expect(
      ttt.validateMove(
        s,
        0,
        onlyEasy.chooseMove({ state: s, seat: 0, level: 'hard', rng: createRng('e', 0), deadlineMs: 0 }),
      ).ok,
    ).toBe(true);
  });

  it('noise = 1 always plays a random candidate, reproducibly', () => {
    const noisy = createBot({
      id: 'noisy',
      def: ttt,
      evaluate,
      levels: { easy: { algo: 'greedy', timeMs: 100, noise: 1 } },
    });
    const s = board('XX.|OO.|...', 0);
    const picks = new Set(
      Array.from(
        { length: 20 },
        (_, i) =>
          noisy.chooseMove({
            state: s,
            seat: 0,
            level: 'easy',
            rng: createRng(`n${i}`, 0),
            deadlineMs: Date.now() + 100,
          }).cell,
      ),
    );
    expect(picks.size).toBeGreaterThan(1);
    const again = () =>
      noisy.chooseMove({
        state: s,
        seat: 0,
        level: 'easy',
        rng: createRng('same', 0),
        deadlineMs: Date.now() + 100,
      });
    expect(again()).toEqual(again());
  });
});

describe('terminalScore', () => {
  it('scores wins, losses and draws from the seat point of view', () => {
    expect(terminalScore({ kind: 'win', winners: [0], reason: 'x' }, 0, 3)).toBe(WIN_SCORE - 3);
    expect(terminalScore({ kind: 'win', winners: [0], reason: 'x' }, 1, 3)).toBe(-WIN_SCORE + 3);
    expect(terminalScore({ kind: 'draw', reason: 'x' }, 1, 3)).toBe(0);
  });
});
