// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { fromFen, squareName } from '../src/rules/board';
import vi from '../src/i18n/vi.json';
import {
  CHECK_ROUNDS,
  CHECKMATE_LESSON_ID,
  JUDGE_ROUNDS,
  MATE_ROUNDS,
  matingMoves,
} from '../src/learn/checkmate';
import { CheckmateLesson } from '../src/learn/CheckmateLesson';
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
  tr(`games.chess.learn.checkmate.${key}`, values);
const click = (square: string) => fireEvent.click(document.querySelector(`[data-square="${square}"]`)!);
const status = () => screen.getByRole('status').textContent;
const pieceAt = (square: string) =>
  document.querySelector(`[data-square="${square}"]`)!.getAttribute('data-piece');
const nextName = tr('games.chess.learn.next');
const next = () => fireEvent.click(screen.getByRole('button', { name: nextName }));
const onRound = (n: number, total: number) =>
  waitFor(() => expect(screen.getByTestId('mate-prompt').textContent).toContain(`${n}/${total}`));
const finish = () => waitFor(() => screen.getByRole('button', { name: nextName }));

/** Plays the first three stages the right way, leaving the lesson at "find the mate". */
async function reachMateStage() {
  next(); // meet -> check
  for (const [i, round] of CHECK_ROUNDS.entries()) {
    await onRound(i + 1, CHECK_ROUNDS.length);
    click(round.attacker);
  }
  await finish();
  next();
  const escapes: [string, string][] = [
    ['e1', 'd1'],
    ['d6', 'e8'],
    ['c4', 'e2'],
  ];
  for (const [i, [from, to]] of escapes.entries()) {
    await onRound(i + 1, 3);
    click(from);
    click(to);
  }
  await finish();
  next();
  for (const [i, round] of JUDGE_ROUNDS.entries()) {
    await onRound(i + 1, JUDGE_ROUNDS.length);
    fireEvent.click(screen.getByRole('button', { name: c(round.mate ? 'judge.mate' : 'judge.save') }));
  }
  await finish();
  next();
}

describe('CheckmateLesson', () => {
  it('has Vietnamese text for everything the lesson shows', () => {
    const keys = [
      'name',
      'meet',
      'done',
      'fun',
      'right',
      'allDone',
      'wrong.check',
      'escape.illegal',
      'escape.other',
      'judge.save',
      'judge.mate',
      'judge.rightSave',
      'judge.rightMate',
      'judge.wrong',
      'mate.right',
      'mate.escaped',
      'mate.noCheck',
      'mate.defended',
      'mate.stalemate',
      'mate.hint1',
      'mate.hint2',
      'prompt.check',
      'prompt.judge',
      'prompt.mate',
      'prompt.escape.run',
      'prompt.escape.block',
      'prompt.escape.capture',
      'kind.run',
      'kind.block',
      'kind.capture',
      ...['check', 'escape', 'judge', 'mate'].map((k) => `intro.${k}`),
      ...['meet', 'check', 'escape', 'judge', 'mate', 'done'].map((k) => `stage.${k}`),
    ];
    for (const k of keys) expect(get(vi.learn.checkmate, k), k).toBeTypeOf('string');
    expect(LESSON_IDS).toContain(CHECKMATE_LESSON_ID);
  });

  it('plays the whole lesson: check, saving the king, mate or not, finding mate', async () => {
    const done: string[] = [];
    render(<CheckmateLesson t={tr} animate={false} advanceDelay={0} onComplete={(id) => done.push(id)} />);
    next(); // meet -> check

    // 1. Tap the attacker; a wrong piece gets a hint.
    for (const [i, round] of CHECK_ROUNDS.entries()) {
      await onRound(i + 1, CHECK_ROUNDS.length);
      if (i === 0) {
        click('e1');
        expect(status()).toBe(c('wrong.check'));
      }
      click(round.attacker);
      expect(status()).toBe(c('right'));
    }
    await finish();
    next();

    // 2. Run, capture, block: the wrong way of saving the king is named, not accepted.
    await onRound(1, 3);
    click('e1');
    click('d1');
    expect(status()).toBe(c('right'));
    await onRound(2, 3);
    click('d6');
    click('e8');
    expect(status()).toBe(c('right'));
    await onRound(3, 3);
    click('e1');
    click('d1'); // a run, but this round asks to block
    expect(status()).toBe(c('escape.other', { did: c('kind.run'), asked: c('kind.block') }));
    click('c4');
    click('e2');
    expect(status()).toBe(c('right'));
    await finish();
    next();

    // 3. Can the king be saved? One wrong answer first.
    for (const [i, round] of JUDGE_ROUNDS.entries()) {
      await onRound(i + 1, JUDGE_ROUNDS.length);
      if (i === 0) {
        fireEvent.click(screen.getByRole('button', { name: c(round.mate ? 'judge.save' : 'judge.mate') }));
        expect(status()).toBe(c('judge.wrong'));
      }
      fireEvent.click(screen.getByRole('button', { name: c(round.mate ? 'judge.mate' : 'judge.save') }));
      expect(status()).toBe(c(round.mate ? 'judge.rightMate' : 'judge.rightSave'));
    }
    await finish();
    next();

    // 4. Find the mate. A move that is not mate is undone after the king escapes.
    for (const [i, round] of MATE_ROUNDS.entries()) {
      await onRound(i + 1, MATE_ROUNDS.length);
      const mate = matingMoves(fromFen(round.fen))[0]!;
      if (i === 0) {
        click('a1');
        click('a2'); // the queen steps aside: not mate
        expect(status()).toBe(c('mate.noCheck'));
        await waitFor(() => expect(pieceAt('a1')).toBe('wQ'));
      }
      click(squareName(mate.from));
      click(squareName(mate.to));
      expect(status()).toBe(c('mate.right'));
    }
    await finish();
    expect(done).toEqual([]);
    next();
    expect(done).toEqual([CHECKMATE_LESSON_ID]);
  });

  it('hint: first the piece, then the square', async () => {
    render(<CheckmateLesson t={tr} animate={false} advanceDelay={0} />);
    await reachMateStage();

    await onRound(1, MATE_ROUNDS.length);
    const mate = matingMoves(fromFen(MATE_ROUNDS[0]!.fen))[0]!;
    const hint = screen.getByRole('button', { name: tr('games.chess.learn.hint') });
    fireEvent.click(hint);
    expect(status()).toBe(c('mate.hint1', { from: squareName(mate.from) }));
    fireEvent.click(hint);
    expect(status()).toBe(c('mate.hint2', { from: squareName(mate.from), to: squareName(mate.to) }));
  });

  it('accepts any mating move, not only the first one', async () => {
    render(<CheckmateLesson t={tr} animate={false} advanceDelay={0} />);
    await reachMateStage();

    // Round 3 has several mates (Qg7, Qg8, Qh1): play the last one listed.
    for (const i of [0, 1]) {
      await onRound(i + 1, MATE_ROUNDS.length);
      const first = matingMoves(fromFen(MATE_ROUNDS[i]!.fen))[0]!;
      click(squareName(first.from));
      click(squareName(first.to));
    }
    await onRound(3, MATE_ROUNDS.length);
    const mates = matingMoves(fromFen(MATE_ROUNDS[2]!.fen));
    expect(mates.length).toBeGreaterThan(1);
    const last = mates[mates.length - 1]!;
    click(squareName(last.from));
    click(squareName(last.to));
    expect(status()).toBe(c('mate.right'));
  });
});
