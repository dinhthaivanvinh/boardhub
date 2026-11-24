// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import vi from '../src/i18n/vi.json';
import { OPENING_LESSONS, PIECE_LESSONS } from '../src/learn/data';
import { OpeningLesson } from '../src/learn/OpeningLesson';
import { PieceLesson } from '../src/learn/PieceLesson';

afterEach(cleanup);

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
const tr = (key: string, values?: Record<string, string | number>) => {
  const text = get(vi, key.replace(/^games\.chess\./, ''));
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? ''));
};
const click = (square: string) => fireEvent.click(document.querySelector(`[data-square="${square}"]`)!);
const next = () => fireEvent.click(screen.getByRole('button', { name: tr('games.chess.learn.next') }));
const backName = tr('games.chess.learn.back');
const back = () => fireEvent.click(screen.getByRole('button', { name: backName }));
const current = () => document.querySelector('.ch-learn-steps [aria-current="step"]')!.textContent;
const pieceAt = (square: string) =>
  document.querySelector(`[data-square="${square}"]`)!.getAttribute('data-piece');

describe('going back in a lesson', () => {
  const knight = PIECE_LESSONS.find((l) => l.id === 'knight')!;
  const stage = (s: string) => tr(`games.chess.learn.stage.${s}`);

  it('the Back button steps to the previous step, and is off on the first one', () => {
    render(<PieceLesson lesson={knight} t={tr} animate={false} />);
    expect(screen.queryByRole('button', { name: backName })).toBeNull();
    expect(current()).toBe(stage('meet'));

    next();
    next();
    expect(current()).toBe(stage('try'));
    back();
    expect(current()).toBe(stage('watch'));
    back();
    expect(current()).toBe(stage('meet'));
    expect(screen.queryByRole('button', { name: backName })).toBeNull();
  });

  it('a step already done can be tapped to jump back to it', () => {
    render(<PieceLesson lesson={knight} t={tr} animate={false} />);
    next();
    next();
    // "Meet" and "Watch" are behind us: they are buttons now. The ones ahead are plain text.
    const steps = document.querySelectorAll('.ch-learn-steps li');
    expect(steps[0]!.querySelector('button')).not.toBeNull();
    expect(steps[1]!.querySelector('button')).not.toBeNull();
    expect(steps[3]!.querySelector('button')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: stage('meet') }));
    expect(current()).toBe(stage('meet'));
  });

  it('the finished screen praises, offers the next lesson and starting again', () => {
    render(
      <PieceLesson
        lesson={knight}
        t={tr}
        animate={false}
        footer={<a href="/learn/chess/capture">Bài tiếp theo</a>}
      />,
    );
    next();
    next();
    for (const sq of ['b5', 'c6', 'e6', 'f5']) click(sq);
    next(); // try -> challenge
    click('d4');
    click('b5');
    next(); // challenge -> done

    expect(screen.getByRole('heading', { name: tr('games.chess.learn.great') })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Bài tiếp theo' }).getAttribute('href')).toBe(
      '/learn/chess/capture',
    );
    fireEvent.click(screen.getByRole('button', { name: tr('games.chess.learn.again') }));
    expect(current()).toBe(stage('meet'));
  });
});

describe('opening lessons: back a move', () => {
  it("goes back to the child's previous move, and is off at the start", async () => {
    const lesson = OPENING_LESSONS.find((l) => l.id === 'italian')!;
    render(<OpeningLesson lesson={lesson} t={tr} animate={false} opponentDelay={0} />);
    const backMove = () =>
      screen.queryByRole('button', { name: tr('games.chess.learn.backMove') }) as HTMLButtonElement;
    expect(backMove()).toBeNull();

    click('e2');
    click('e4');
    await waitFor(() => expect(pieceAt('e5')).toBe('bP')); // the opponent answered
    expect(backMove()).not.toBeNull();

    fireEvent.click(backMove());
    expect(pieceAt('e2')).toBe('wP'); // the pawn is home again
    expect(pieceAt('e5')).toBeNull();
    expect(backMove()).toBeNull();
  });

  it('playing Black: the first move of White is not undone', async () => {
    const lesson = OPENING_LESSONS.find((l) => l.id === 'sicilian')!;
    render(<OpeningLesson lesson={lesson} t={tr} animate={false} opponentDelay={0} />);
    const backMove = () =>
      screen.queryByRole('button', { name: tr('games.chess.learn.backMove') }) as HTMLButtonElement;
    await waitFor(() => expect(pieceAt('e4')).toBe('wP')); // White opened by itself
    expect(backMove()).toBeNull(); // nothing before the child's first move
  });
});
