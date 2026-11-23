// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { fromFen, legalMoves, squareName } from '../src/rules/board';
import vi from '../src/i18n/vi.json';
import {
  ATTACKED_ROUNDS,
  capturable,
  CAPTURE_LESSON_ID,
  captures,
  isSafeCapture,
  PIECE_VALUE,
  SAFE_ROUNDS,
  TAKE_ROUNDS,
  toMove,
  VALUE_ROUNDS,
} from '../src/learn/capture';
import { CaptureLesson } from '../src/learn/CaptureLesson';
import { LESSON_IDS } from '../src/learn/data';

afterEach(cleanup);

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
const tr = (key: string, values?: Record<string, string | number>) => {
  const text = get(vi, key.replace(/^games\.chess\./, ''));
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? ''));
};
const c = (key: string, values?: Record<string, string | number>) =>
  tr(`games.chess.learn.capture.${key}`, values);
const click = (square: string) => fireEvent.click(document.querySelector(`[data-square="${square}"]`)!);
const status = () => screen.getByRole('status').textContent;
const nextName = tr('games.chess.learn.next');
const next = () => fireEvent.click(screen.getByRole('button', { name: nextName }));
const onRound = (n: number, total: number) =>
  waitFor(() => expect(screen.getByTestId('mate-prompt').textContent).toContain(`${n}/${total}`));
const finish = () => waitFor(() => screen.getByRole('button', { name: nextName }));
const name = (type: string) => tr(`games.chess.pieceNames.${type}`);

describe('CaptureLesson', () => {
  it('has Vietnamese text for everything the lesson shows', () => {
    const keys = [
      'name',
      'meet',
      'done',
      'fun',
      'allDone',
      'take.illegal',
      'take.notCapture',
      'take.right',
      'take.hint',
      'attacked.wrong',
      'attacked.right',
      'attacked.hint',
      'safe.eat',
      'safe.skip',
      'safe.rightFree',
      'safe.rightGuarded',
      'safe.wrongFree',
      'safe.wrongGuarded',
      'value.right',
      'value.wrong',
      ...['take', 'attacked', 'safe', 'value'].flatMap((k) => [`intro.${k}`, `prompt.${k}`]),
      ...['meet', 'take', 'attacked', 'safe', 'value', 'done'].map((k) => `stage.${k}`),
    ];
    for (const k of keys) expect(get(vi.learn.capture, k), k).toBeTypeOf('string');
    expect(LESSON_IDS).toContain(CAPTURE_LESSON_ID);
  });

  it('plays the whole lesson: taking, danger, guarded or free, and what pieces are worth', async () => {
    const done: string[] = [];
    render(<CaptureLesson t={tr} animate={false} advanceDelay={0} onComplete={(id) => done.push(id)} />);
    next(); // meet -> take

    // 1. Take a black piece. A plain move is refused; any capture is accepted.
    for (const [i, round] of TAKE_ROUNDS.entries()) {
      await onRound(i + 1, TAKE_ROUNDS.length);
      const pos = fromFen(round.fen);
      if (i === 0) {
        const plain = legalMoves(pos).find(
          (m) => !captures(pos).some((x) => x.from === m.from && x.to === m.to),
        )!;
        click(squareName(plain.from));
        click(squareName(plain.to));
        expect(status()).toBe(c('take.notCapture'));
      }
      // The last round has two captures: the second one is as good as the first.
      const move = captures(pos)[i === TAKE_ROUNDS.length - 1 ? 1 : 0]!;
      click(squareName(move.from));
      click(squareName(move.to));
      expect(status()).toBe(c('take.right'));
    }
    await finish();
    next();

    // 2. Which white piece is in danger? The king is not.
    for (const [i, round] of ATTACKED_ROUNDS.entries()) {
      await onRound(i + 1, ATTACKED_ROUNDS.length);
      const pos = fromFen(round.fen);
      if (i === 0) {
        click('a1'); // the white king is safe
        expect(status()).toBe(c('attacked.wrong'));
      }
      click(squareName(capturable(pos)[0]!));
      expect(status()).toBe(c('attacked.right'));
    }
    await finish();
    next();

    // 3. Take it or leave it? One wrong answer first.
    for (const [i, round] of SAFE_ROUNDS.entries()) {
      await onRound(i + 1, SAFE_ROUNDS.length);
      const safe = isSafeCapture(fromFen(round.fen), toMove(round));
      if (i === 0) {
        fireEvent.click(screen.getByRole('button', { name: c(safe ? 'safe.skip' : 'safe.eat') }));
        expect(status()).toBe(c(safe ? 'safe.wrongFree' : 'safe.wrongGuarded'));
      }
      fireEvent.click(screen.getByRole('button', { name: c(safe ? 'safe.eat' : 'safe.skip') }));
      expect(status()).toBe(c(safe ? 'safe.rightFree' : 'safe.rightGuarded'));
    }
    await finish();
    next();

    // 4. Which is worth more?
    for (const [i, round] of VALUE_ROUNDS.entries()) {
      await onRound(i + 1, VALUE_ROUNDS.length);
      const big = PIECE_VALUE[round.left] > PIECE_VALUE[round.right] ? round.left : round.right;
      const small = big === round.left ? round.right : round.left;
      if (i === 0) {
        fireEvent.click(screen.getByRole('button', { name: name(small) }));
        expect(status()).toBe(c('value.wrong'));
      }
      fireEvent.click(screen.getByRole('button', { name: name(big) }));
      expect(status()).toBe(
        c('value.right', {
          big: name(big),
          bigPoints: PIECE_VALUE[big],
          small: name(small),
          smallPoints: PIECE_VALUE[small],
        }),
      );
    }
    await finish();
    expect(done).toEqual([]);
    next();
    expect(done).toEqual([CAPTURE_LESSON_ID]);
  });
});
