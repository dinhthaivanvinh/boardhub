// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import vi from '../src/i18n/vi.json';
import { fromFen, squareOf } from '../src/rules/board';
import { DrawsLesson, SetupLesson } from '../src/learn/BasicsLessons';
import {
  DRAW_QUIZ,
  DRAWS_LESSON_ID,
  isLightSquare,
  JUDGE_ROUNDS,
  outcomeOf,
  PLACE_ROUNDS,
  SETUP_LESSON_ID,
  SETUP_QUIZ,
  START_FEN,
} from '../src/learn/basics';
import { JOURNEY_LESSONS } from '../src/learn/journey';
import { LESSON_IDS } from '../src/learn/data';

afterEach(cleanup);

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
const make = (messages: unknown) => (key: string, values?: Record<string, string | number>) => {
  const text = get(messages, key.replace(/^games\.chess\./, ''));
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? ''));
};
const tr = make(vi);
const status = () => screen.getByRole('status').textContent;
const onRound = (n: number, total: number) =>
  waitFor(() => expect(screen.getByTestId('mate-prompt').textContent).toContain(`${n}/${total}`));
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const next = () => press(tr('games.chess.learn.next'));

describe('the lessons are on the way of learning', () => {
  it('both are lessons, and the journey has them in the right place', () => {
    for (const id of [SETUP_LESSON_ID, DRAWS_LESSON_ID]) {
      expect(LESSON_IDS as readonly string[]).toContain(id);
      expect(JOURNEY_LESSONS).toContain(id);
    }
    expect(JOURNEY_LESSONS.indexOf(SETUP_LESSON_ID)).toBe(JOURNEY_LESSONS.indexOf('coordinates') + 1);
    expect(JOURNEY_LESSONS.indexOf(DRAWS_LESSON_ID)).toBe(JOURNEY_LESSONS.indexOf('checkmate') + 1);
  });
});

describe('the facts the lessons teach are true on the board', () => {
  it('every piece of the "find the piece" stage stands where the start position has it', () => {
    const start = fromFen(START_FEN);
    for (const r of PLACE_ROUNDS)
      expect(start.board[squareOf(r.square)], r.square).toBe(`${r.color}${r.piece}`);
  });

  it('White moves first, the right-hand corner is light, and the queen stands on her own colour', () => {
    const start = fromFen(START_FEN);
    expect(start.turn).toBe('w');
    expect(isLightSquare('h1')).toBe(true);
    expect(isLightSquare('a8')).toBe(true);
    expect(isLightSquare('d1')).toBe(true); // the white queen
    expect(isLightSquare('d8')).toBe(false); // the black queen
    expect(isLightSquare('e1')).toBe(false); // the white king has the other colour
    // The answers of the quiz.
    const idx = (id: string) => SETUP_QUIZ.find((q) => q.id === id)!.answer;
    expect(idx('first')).toBe(0); // White
    expect(idx('corner')).toBe(isLightSquare('h1') ? 0 : 1); // option 0 is "light"
    expect(idx('queenColor')).toBe(isLightSquare('d8') ? 0 : 1);
    expect(idx('turns')).toBe(1); // Black
  });

  it('the engine agrees with the answer of every position, and all three answers are used', () => {
    for (const r of JUDGE_ROUNDS) expect(outcomeOf(r.fen), r.id).toBe(r.outcome);
    expect(new Set(JUDGE_ROUNDS.map((r) => r.outcome)).size).toBe(3);
    // The mate really is the side to move being checkmated, and the stalemate has no check.
    expect(outcomeOf(JUDGE_ROUNDS.find((r) => r.id === 'stalemate')!.fen)).toBe('draw');
  });

  it('has an answer index inside the options of every quiz', () => {
    for (const q of [...SETUP_QUIZ, ...DRAW_QUIZ]) {
      expect(q.answer).toBeLessThan(q.options);
      expect(q.options).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('the texts', () => {
  for (const [lang, messages] of [
    ['vi', vi],
    ['en', en],
  ] as const) {
    it(`${lang}: every question, answer and result has a text`, () => {
      const text = (path: string) =>
        expect(get(messages.learn, path), `${lang} ${path}`).toBeTypeOf('string');
      for (const lesson of ['setup', 'draws']) {
        for (const k of ['name', 'meet', 'allDone', 'done', 'fun']) text(`${lesson}.${k}`);
      }
      for (const s of ['meet', 'place', 'ask', 'done']) text(`setup.stage.${s}`);
      for (const s of ['meet', 'judge', 'facts', 'done']) text(`draws.stage.${s}`);
      for (const k of ['place', 'ask']) text(`setup.intro.${k}`);
      for (const k of ['judge', 'facts']) text(`draws.intro.${k}`);
      for (const k of [
        'setup.prompt.place',
        'setup.place.right',
        'setup.place.wrong',
        'setup.color.w',
        'setup.color.b',
      ])
        text(k);
      for (const k of [
        'prompt.judge',
        'side.w',
        'side.b',
        'judge.win',
        'judge.draw',
        'judge.ongoing',
        'judge.wrong',
      ])
        text(`draws.${k}`);
      for (const r of JUDGE_ROUNDS) text(`draws.judge.${r.id}.right`);
      for (const [lesson, quiz] of [
        ['setup', SETUP_QUIZ],
        ['draws', DRAW_QUIZ],
      ] as const) {
        for (const q of quiz) {
          for (const k of ['q', 'right', 'wrong']) text(`${lesson}.quiz.${q.id}.${k}`);
          for (let i = 0; i < q.options; i++) text(`${lesson}.quiz.${q.id}.o${i}`);
        }
      }
    });
  }
});

describe('SetupLesson', () => {
  const c = (key: string, values?: Record<string, string | number>) =>
    tr(`games.chess.learn.setup.${key}`, values);
  const render0 = (done: string[]) =>
    render(<SetupLesson t={tr} animate={false} advanceDelay={0} onComplete={(id) => done.push(id)} />);

  it('can be played from the first page to the finished screen, and is reported once', async () => {
    const done: string[] = [];
    render0(done);
    expect(screen.getByText(c('meet'))).toBeTruthy();
    next();

    // Find the piece: a wrong piece is refused with a kind message, the right one is named.
    await onRound(1, PLACE_ROUNDS.length);
    const piece = (type: 'K' | 'Q' | 'R' | 'B' | 'N' | 'P') => tr(`games.chess.pieceNames.${type}`);
    press(piece('P'));
    expect(status()).toBe(c('place.wrong'));
    for (const [i, r] of PLACE_ROUNDS.entries()) {
      await onRound(i + 1, PLACE_ROUNDS.length);
      press(piece(r.piece));
      expect(status()).toBe(
        c('place.right', {
          square: r.square,
          piece: piece(r.piece).toLowerCase(),
          color: c(`color.${r.color}`),
        }),
      );
    }
    await waitFor(() => screen.getByText(c('allDone')));
    next();

    for (const [i, q] of SETUP_QUIZ.entries()) {
      await onRound(i + 1, SETUP_QUIZ.length);
      const wrongIndex = (q.answer + 1) % q.options;
      press(c(`quiz.${q.id}.o${wrongIndex}`));
      expect(status()).toBe(c(`quiz.${q.id}.wrong`));
      press(c(`quiz.${q.id}.o${q.answer}`));
      expect(status()).toBe(c(`quiz.${q.id}.right`));
    }
    await waitFor(() => screen.getByText(c('allDone')));
    expect(done).toEqual([]);
    next();
    expect(screen.getByText(c('done'))).toBeTruthy();
    expect(done).toEqual([SETUP_LESSON_ID]);
  });
});

describe('DrawsLesson', () => {
  const c = (key: string, values?: Record<string, string | number>) =>
    tr(`games.chess.learn.draws.${key}`, values);

  it('can be played from the first page to the finished screen, and is reported once', async () => {
    const done: string[] = [];
    render(<DrawsLesson t={tr} animate={false} advanceDelay={0} onComplete={(id) => done.push(id)} />);
    next();

    for (const [i, r] of JUDGE_ROUNDS.entries()) {
      await onRound(i + 1, JUDGE_ROUNDS.length);
      const wrong = r.outcome === 'win' ? 'draw' : 'win';
      press(c(`judge.${wrong}`));
      expect(status()).toBe(c('judge.wrong'));
      press(c(`judge.${r.outcome}`));
      expect(status()).toBe(c(`judge.${r.id}.right`));
    }
    await waitFor(() => screen.getByText(c('allDone')));
    next();

    for (const [i, q] of DRAW_QUIZ.entries()) {
      await onRound(i + 1, DRAW_QUIZ.length);
      press(c(`quiz.${q.id}.o${(q.answer + 1) % q.options}`));
      expect(status()).toBe(c(`quiz.${q.id}.wrong`));
      press(c(`quiz.${q.id}.o${q.answer}`));
      expect(status()).toBe(c(`quiz.${q.id}.right`));
    }
    await waitFor(() => screen.getByText(c('allDone')));
    next();
    expect(screen.getByText(c('done'))).toBeTruthy();
    expect(done).toEqual([DRAWS_LESSON_ID]);
  });
});
