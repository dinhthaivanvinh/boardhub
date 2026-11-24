// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import vi from '../src/i18n/vi.json';
import { PracticeLesson } from '../src/learn/PracticeLesson';
import { practiceRounds, type PracticeRound } from '../src/learn/practice';

afterEach(cleanup);

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
const tr = (key: string, values?: Record<string, string | number>) => {
  const text = get(vi, key.replace(/^games\.chess\./, ''));
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? ''));
};
const c = (key: string, values?: Record<string, string | number>) =>
  tr(`games.chess.learn.practice.${key}`, values);
const click = (square: string) => fireEvent.click(document.querySelector(`[data-square="${square}"]`)!);
const status = () => screen.getByRole('status').textContent;
const onRound = (n: number, total: number) =>
  waitFor(() => expect(screen.getByTestId('mate-prompt').textContent).toContain(`${n}/${total}`));

/** Answers a round the way a child would. */
function answer(round: PracticeRound) {
  if (round.kind === 'star') click(round.answer);
  else {
    click(round.from);
    click(round.to);
  }
}

const renderLesson = (lessonId: string, done: string[]) =>
  render(
    <PracticeLesson
      lessonId={lessonId}
      lessonName={lessonId}
      t={tr}
      animate={false}
      advanceDelay={0}
      onComplete={(id) => done.push(id)}
    />,
  );

describe('PracticeLesson', () => {
  it('has Vietnamese text for everything the practice shows', () => {
    const keys = [
      'title',
      'allDone',
      'done',
      ...['star', 'capture', 'opening', 'castling', 'enPassant', 'promotion'].flatMap((k) => [
        `intro.${k}`,
        `prompt.${k}`,
      ]),
      'intro.done',
      'star.right',
      'star.wrong',
      'star.hint',
      'move.right',
      'move.illegal',
      'move.notGoal',
      'move.hint1',
      'move.hint2',
      'stage.practice',
      'stage.done',
      'cta',
      'toLesson',
      'morePuzzles',
    ];
    for (const k of keys) expect(get(vi.learn.practice, k), k).toBeTypeOf('string');
  });

  for (const lessonId of [
    'rook',
    'queens-gambit',
    'sicilian',
    'castling',
    'en-passant',
    'promotion',
    'capture',
  ]) {
    it(`${lessonId}: can be played from the first question to the finished screen, and is reported once`, async () => {
      const done: string[] = [];
      const rounds = practiceRounds(lessonId)!;
      renderLesson(lessonId, done);
      for (const [i, round] of rounds.entries()) {
        await onRound(i + 1, rounds.length);
        answer(round);
        expect(status()).not.toBe('');
      }
      await waitFor(() => screen.getByText(c('allDone')));
      expect(done).toEqual([]);
      fireEvent.click(screen.getByRole('button', { name: tr('games.chess.learn.next') }));
      expect(screen.getByText(c('done', { stars: 2 }))).toBeTruthy();
      expect(done).toEqual([`practice-${lessonId}`]);
    });
  }

  it('a wrong piece or a wrong move is refused with a kind message and the question stays', async () => {
    renderLesson('rook', []);
    const rounds = practiceRounds('rook')!;
    await onRound(1, rounds.length);
    const star = rounds[0]!;
    if (star.kind !== 'star') throw new Error('first round is a star round');
    // Any square but the answer: the board has two other white pieces and the king.
    const other = [...document.querySelectorAll<HTMLElement>('[data-piece^="w"]')].find(
      (el) => el.dataset.square !== star.answer,
    )!;
    fireEvent.click(other);
    expect(status()).toBe(c('star.wrong'));
    await onRound(1, rounds.length);
    click(star.answer);
    expect(status()).toBe(c('star.right'));
  });

  it('a legal but wrong move says so, and an impossible one says that', async () => {
    renderLesson('castling', []);
    const rounds = practiceRounds('castling')!;
    await onRound(1, rounds.length);
    click('e1');
    click('d1'); // the king can step there, but it is not the castling
    expect(status()).toBe(c('move.notGoal'));
    click('e1');
    click('e5'); // too far
    expect(status()).toBe(c('move.illegal'));
    answer(rounds[0]!);
    expect(status()).toBe(c('move.right'));
  });

  it('the hints name the piece, then the square', async () => {
    renderLesson('promotion', []);
    const rounds = practiceRounds('promotion')!;
    await onRound(1, rounds.length);
    const hint = screen.getByRole('button', { name: new RegExp(tr('games.chess.learn.hint')) });
    fireEvent.click(hint);
    expect(status()).toBe(c('move.hint1', { from: 'e7' }));
    fireEvent.click(hint);
    expect(status()).toBe(c('move.hint2', { from: 'e7', to: 'e8' }));
  });
});
