// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { fromFen, inCheck, legalMoves, squareName } from '../src/rules/board';
import vi from '../src/i18n/vi.json';
import { isStalemate, matingMoves } from '../src/learn/checkmate';
import { LESSON_IDS } from '../src/learn/data';
import {
  DRAW_ROUNDS,
  drawKind,
  FORK_ROUNDS,
  forkMoves,
  LADDER_ROUNDS,
  PIN_ROUNDS,
  pinnedSquares,
  TACTICS_LESSON_ID,
} from '../src/learn/tactics';
import { TacticsLesson } from '../src/learn/TacticsLesson';
import { makeMove } from '../src/rules/board';

afterEach(cleanup);

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
const tr = (key: string, values?: Record<string, string | number>) => {
  const text = get(vi, key.replace(/^games\.chess\./, ''));
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? ''));
};
const c = (key: string, values?: Record<string, string | number>) =>
  tr(`games.chess.learn.tactics.${key}`, values);
const click = (square: string) => fireEvent.click(document.querySelector(`[data-square="${square}"]`)!);
const status = () => screen.getByRole('status').textContent;
const nextName = tr('games.chess.learn.next');
const next = () => fireEvent.click(screen.getByRole('button', { name: nextName }));
const onRound = (n: number, total: number) =>
  waitFor(() => expect(screen.getByTestId('mate-prompt').textContent).toContain(`${n}/${total}`));
const finish = () => waitFor(() => screen.getByRole('button', { name: nextName }));

describe('tactics lesson data (ladder)', () => {
  it('ladder rounds: White mates in one, Black is not in check, and no mate is a stalemate', () => {
    for (const { fen } of LADDER_ROUNDS) {
      const pos = fromFen(fen);
      expect(pos.turn, fen).toBe('w');
      expect(inCheck(pos.board, 'b'), fen).toBe(false);
      const mates = matingMoves(pos);
      expect(mates.length, fen).toBeGreaterThan(0);
      for (const m of mates) expect(isStalemate(makeMove(pos, m)), fen).toBe(false);
    }
  });
});

describe('TacticsLesson', () => {
  it('has Vietnamese text for everything the lesson shows', () => {
    const keys = [
      'name',
      'meet',
      'done',
      'fun',
      'allDone',
      'fork.illegal',
      'fork.notFork',
      'fork.right',
      'fork.hint',
      'pin.right',
      'pin.wrong',
      'pin.hint',
      'mate.right',
      'mate.escaped',
      'mate.stalemate',
      'mate.noCheck',
      'mate.defended',
      'mate.illegal',
      'mate.hint1',
      'mate.hint2',
      'draw.mate',
      'draw.stalemate',
      'draw.ongoing',
      'draw.right.mate',
      'draw.right.stalemate',
      'draw.right.ongoing',
      'draw.wrong',
      ...['fork', 'pin', 'mate', 'draw'].flatMap((k) => [`intro.${k}`, `prompt.${k}`]),
      ...['meet', 'fork', 'pin', 'mate', 'draw', 'done'].map((k) => `stage.${k}`),
    ];
    for (const k of keys) expect(get(vi.learn.tactics, k), k).toBeTypeOf('string');
    expect(LESSON_IDS).toContain(TACTICS_LESSON_ID);
  });

  it('plays the whole lesson: forks, pins, two-rook mates, and draw or win', async () => {
    const done: string[] = [];
    render(<TacticsLesson t={tr} animate={false} advanceDelay={0} onComplete={(id) => done.push(id)} />);
    next(); // meet -> fork

    // 1. Forks: a plain move is refused, any safe fork is accepted.
    for (const [i, round] of FORK_ROUNDS.entries()) {
      await onRound(i + 1, FORK_ROUNDS.length);
      const pos = fromFen(round.fen);
      const forks = forkMoves(pos);
      if (i === 0) {
        const plain = legalMoves(pos).find((m) => !forks.some((f) => f.from === m.from && f.to === m.to))!;
        click(squareName(plain.from));
        click(squareName(plain.to));
        expect(status()).toBe(c('fork.notFork'));
      }
      click(squareName(forks[0]!.from));
      click(squareName(forks[0]!.to));
      expect(status()).toBe(c('fork.right'));
    }
    await finish();
    next();

    // 2. Pins: the king is never the answer; the pinned piece is.
    for (const [i, round] of PIN_ROUNDS.entries()) {
      await onRound(i + 1, PIN_ROUNDS.length);
      const pos = fromFen(round.fen);
      if (i === 0) {
        click('e1'); // the king
        expect(status()).toBe(c('pin.wrong'));
      }
      click(squareName(pinnedSquares(pos)[0]!));
      expect(status()).toBe(c('pin.right'));
    }
    await finish();
    next();

    // 3. Two rooks: any mating move, and one that is not mate is undone.
    for (const [i, round] of LADDER_ROUNDS.entries()) {
      await onRound(i + 1, LADDER_ROUNDS.length);
      const pos = fromFen(round.fen);
      const mate = matingMoves(pos)[0]!;
      click(squareName(mate.from));
      click(squareName(mate.to));
      expect(status()).toBe(c('mate.right'));
    }
    await finish();
    next();

    // 4. Checkmate, stalemate or not over: one wrong answer first.
    for (const [i, round] of DRAW_ROUNDS.entries()) {
      await onRound(i + 1, DRAW_ROUNDS.length);
      const kind = drawKind(fromFen(round.fen));
      if (i === 0) {
        fireEvent.click(screen.getByRole('button', { name: c('draw.ongoing') }));
        expect(status()).toBe(c('draw.wrong'));
      }
      fireEvent.click(screen.getByRole('button', { name: c(`draw.${kind}`) }));
      expect(status()).toBe(c(`draw.right.${kind}`));
    }
    await finish();
    expect(done).toEqual([]);
    next();
    expect(done).toEqual([TACTICS_LESSON_ID]);
  });
});
