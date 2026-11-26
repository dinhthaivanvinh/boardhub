// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import vi from '../src/i18n/vi.json';
import { LESSON_IDS } from '../src/learn/data';
import {
  CASTLE_ROUNDS,
  CENTER_ROUNDS,
  CHOICE_ROUNDS,
  DEFEND_ROUNDS,
  DEVELOP_ROUNDS,
  EARLY_MATE_LESSON_ID,
  OPENING_BASICS_LESSON_ID,
  SPOT_ROUNDS,
  TRAP_LINE,
} from '../src/learn/opening-basics';
import { EarlyMateLesson, OpeningBasicsLesson, REPLAY_STEPS } from '../src/learn/OpeningBasicsLessons';

afterEach(cleanup);

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
const tr = (key: string, values?: Record<string, string | number>) => {
  const text = get(vi, key.replace(/^games\.chess\./, ''));
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? ''));
};
const opening = (key: string) => tr(`games.chess.learn.opening-basics.${key}`);
const early = (key: string) => tr(`games.chess.learn.early-mate.${key}`);
const click = (square: string) => fireEvent.click(document.querySelector(`[data-square="${square}"]`)!);
const play = (move: string) => {
  click(move.slice(0, 2));
  click(move.slice(2, 4));
};
const status = () => screen.getByRole('status').textContent;
const nextName = tr('games.chess.learn.next');
const next = () => fireEvent.click(screen.getByRole('button', { name: nextName }));
const onRound = (n: number, total: number) =>
  waitFor(() => expect(screen.getByTestId('mate-prompt').textContent).toContain(`${n}/${total}`));
const finishStage = async () => {
  await waitFor(() => screen.getByRole('button', { name: nextName }));
  next();
};

describe('OpeningBasicsLesson', () => {
  it('plays the whole lesson, naming what is wrong with a move', async () => {
    const done: string[] = [];
    render(
      <OpeningBasicsLesson t={tr} animate={false} advanceDelay={0} onComplete={(id) => done.push(id)} />,
    );
    next();

    await onRound(1, CENTER_ROUNDS.length);
    play('a2a3');
    expect(status()).toBe(opening('center.notCenter'));
    // The wrong move is taken back.
    await waitFor(() =>
      expect(document.querySelector('[data-square="a2"]')!.getAttribute('data-piece')).toBe('wP'),
    );
    for (const [i, round] of CENTER_ROUNDS.entries()) {
      await onRound(i + 1, CENTER_ROUNDS.length);
      play(round.suggest);
      expect(status()).toBe(opening('center.good'));
    }
    await finishStage();

    for (const [i, round] of DEVELOP_ROUNDS.entries()) {
      await onRound(i + 1, DEVELOP_ROUNDS.length);
      play(round.suggest);
      expect(status()).toBe(opening('develop.good'));
    }
    await finishStage();

    for (const [i, round] of CASTLE_ROUNDS.entries()) {
      await onRound(i + 1, CASTLE_ROUNDS.length);
      play(round.suggest);
      expect(status()).toBe(opening('safe.good'));
    }
    await finishStage();

    for (const [i, round] of CHOICE_ROUNDS.entries()) {
      await onRound(i + 1, CHOICE_ROUNDS.length);
      const wrong = round.options.find((o) => o.flaw !== null)!;
      fireEvent.click(document.querySelector(`[data-move="${wrong.move}"]`)!);
      expect(status()).toBe(opening(`choose.wrong.${wrong.flaw}`));
      const right = round.options.find((o) => o.flaw === null)!;
      fireEvent.click(document.querySelector(`[data-move="${right.move}"]`)!);
      expect(status()).toBe(opening(`choose.right.${round.id}`));
    }
    await waitFor(() => screen.getByRole('button', { name: nextName }));
    expect(done).toEqual([]);
    next();
    expect(done).toEqual([OPENING_BASICS_LESSON_ID]);
    expect(LESSON_IDS).toContain(OPENING_BASICS_LESSON_ID);
  });

  it('hint: first the piece, then the square', async () => {
    render(<OpeningBasicsLesson t={tr} animate={false} advanceDelay={0} />);
    next();
    await onRound(1, CENTER_ROUNDS.length);
    const hint = screen.getByRole('button', { name: tr('games.chess.learn.hint') });
    fireEvent.click(hint);
    expect(status()).toBe(tr('games.chess.learn.hintFrom', { square: 'e2' }));
    fireEvent.click(hint);
    expect(status()).toBe(tr('games.chess.learn.hintTo', { from: 'e2', square: 'e4' }));
  });
});

describe('EarlyMateLesson', () => {
  /** To the stage where the whole game is played again. */
  async function reachReplay() {
    next(); // meet -> watch
    for (let i = 0; i < TRAP_LINE.length; i++) {
      fireEvent.click(screen.getByRole('button', { name: early('watch.next') }));
      expect(status()).toBe(early(`watch.s${i}`));
    }
    next();

    for (const [i] of SPOT_ROUNDS.entries()) {
      await onRound(i + 1, SPOT_ROUNDS.length);
      click('a7');
      expect(status()).toBe(early('spot.wrong'));
      click('f7');
      expect(status()).toBe(early('spot.right'));
    }
    await finishStage();

    for (const [i, round] of DEFEND_ROUNDS.entries()) {
      await onRound(i + 1, DEFEND_ROUNDS.length);
      if (i === 0) {
        play('g8f6'); // the move of the trap
        expect(status()).toBe(early('defend.mate'));
        await waitFor(() =>
          expect(document.querySelector('[data-square="g8"]')!.getAttribute('data-piece')).toBe('bN'),
        );
      }
      play(round.suggest);
      expect(status()).toBe(early('defend.good'));
    }
    await finishStage();
  }

  const prompt = () => screen.getByTestId('mate-prompt').textContent;
  const asked = (key: string) => waitFor(() => expect(prompt()).toContain(early(`prompt.replay.${key}`)));

  it('after ...g6 the queen comes back and must be stopped again', async () => {
    const done: string[] = [];
    render(<EarlyMateLesson t={tr} animate={false} advanceDelay={0} onComplete={(id) => done.push(id)} />);
    await reachReplay();

    await asked('pawn');
    play('d7d6');
    expect(status()).toBe(early('replay.notThat'));
    await waitFor(() =>
      expect(document.querySelector('[data-square="d7"]')!.getAttribute('data-piece')).toBe('bP'),
    );
    play(REPLAY_STEPS[0]!.suggest);
    await asked('knight');
    play(REPLAY_STEPS[1]!.suggest);
    await asked('defend');
    play('g7g6');
    expect(status()).toBe(early('replay.goOn'));
    // The queen is on f3 now, with the pawn already on g6.
    await waitFor(() =>
      expect(document.querySelector('[data-square="f3"]')!.getAttribute('data-piece')).toBe('wQ'),
    );
    play('g8f6');
    expect(status()).toBe(early('replay.right'));
    await finishStage();
    expect(done).toEqual([EARLY_MATE_LESSON_ID]);
    expect(LESSON_IDS).toContain(EARLY_MATE_LESSON_ID);
  });

  it('another good defence ends the game there', async () => {
    render(<EarlyMateLesson t={tr} animate={false} advanceDelay={0} />);
    await reachReplay();
    await asked('pawn');
    play('e7e5');
    await asked('knight');
    play('b8c6');
    await asked('defend');
    play('d8e7');
    expect(status()).toBe(early('replay.right'));
    await waitFor(() => screen.getByRole('button', { name: nextName }));
  });
});
