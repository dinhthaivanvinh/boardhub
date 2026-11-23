// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { squareName, squareOf } from '../src/rules/board';
import vi from '../src/i18n/vi.json';
import { COORD_KINDS, coordRounds, fileOf, rankOf } from '../src/learn/coordinates';
import { CoordinatesLesson } from '../src/learn/CoordinatesLesson';
import { COORDINATES_LESSON_ID, LESSON_IDS } from '../src/learn/data';

afterEach(cleanup);

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
const tr = (key: string, values?: Record<string, string | number>) => {
  const text = get(vi, key.replace(/^games\.chess\./, ''));
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? ''));
};
const click = (square: string) => fireEvent.click(document.querySelector(`[data-square="${square}"]`)!);

describe('coordinates', () => {
  it('reads the rank and the file of a square', () => {
    const e4 = squareOf('e4');
    expect([rankOf(e4), fileOf(e4)]).toEqual([4, 'e']);
    expect([rankOf(0), fileOf(0)]).toEqual([8, 'a']);
    expect([rankOf(63), fileOf(63)]).toEqual([1, 'h']);
  });

  for (const kind of COORD_KINDS) {
    it(`${kind}: five different, repeatable questions`, () => {
      const rounds = coordRounds(kind);
      expect(rounds).toHaveLength(5);
      expect(coordRounds(kind)).toEqual(rounds);
      const key = (s: number) => (kind === 'rank' ? rankOf(s) : kind === 'file' ? fileOf(s) : s);
      expect(new Set(rounds.map((r) => key(r.square))).size).toBe(5);
    });
  }

  it('treasure: three different names, the right one among them, and the usual mix-ups', () => {
    for (const { square, options } of coordRounds('treasure')) {
      expect(options).toHaveLength(3);
      expect(new Set(options).size).toBe(3);
      expect(options).toContain(square);
      const others = options!.filter((o) => o !== square);
      // One shares the file, the other shares the rank: exactly what a child confuses.
      expect(others.some((o) => fileOf(o) === fileOf(square))).toBe(true);
      expect(others.some((o) => rankOf(o) === rankOf(square))).toBe(true);
    }
  });

  it('has text for every kind in Vietnamese', () => {
    for (const kind of COORD_KINDS) {
      for (const k of [`intro.${kind}`, `prompt.${kind}`, `wrong.${kind}`]) {
        expect(get(vi.learn.coordinates, k), k).toBeTypeOf('string');
      }
    }
    expect(LESSON_IDS).toContain(COORDINATES_LESSON_ID);
  });
});

describe('CoordinatesLesson', () => {
  it('walks through all five kinds of exercise and reports completion', async () => {
    const done: string[] = [];
    render(<CoordinatesLesson t={tr} animate={false} advanceDelay={0} onComplete={(id) => done.push(id)} />);
    const next = () => fireEvent.click(screen.getByRole('button', { name: tr('games.chess.learn.next') }));
    next(); // meet -> rows

    for (const kind of COORD_KINDS) {
      const rounds = coordRounds(kind);
      for (const [i, round] of rounds.entries()) {
        await waitFor(() => expect(screen.getByTestId('coord-prompt').textContent).toContain(`${i + 1}/5`));
        if (kind === 'treasure') {
          // A wrong name is not accepted; the right one is.
          const wrong = round.options!.find((o) => o !== round.square)!;
          fireEvent.click(screen.getByRole('button', { name: squareName(wrong) }));
          expect(screen.getByRole('status').textContent).toBe(
            tr('games.chess.learn.coordinates.wrong.treasure'),
          );
          fireEvent.click(screen.getByRole('button', { name: squareName(round.square) }));
        } else {
          if (i === 0) {
            // A square that is not the answer: refused with the kind's own hint.
            const bad =
              kind === 'rank'
                ? (round.square + 8) % 64
                : kind === 'file'
                  ? ((round.square + 1) % 8) + (round.square & ~7)
                  : (round.square + 9) % 64;
            click(squareName(bad));
            expect(screen.getByRole('status').textContent).toBe(
              tr(`games.chess.learn.coordinates.wrong.${kind}`, { square: squareName(round.square) }),
            );
          }
          click(squareName(round.square));
        }
        expect(screen.getByRole('status').textContent).toBe(tr('games.chess.learn.coordinates.right'));
      }
      await waitFor(() => screen.getByRole('button', { name: tr('games.chess.learn.next') }));
      expect(screen.getByRole('status').textContent).toBe(tr('games.chess.learn.coordinates.allDone'));
      expect(done).toEqual([]);
      next();
    }
    expect(done).toEqual([COORDINATES_LESSON_ID]);
  });

  it('find: no lines until the child asks for a hint', async () => {
    render(<CoordinatesLesson t={tr} animate={false} advanceDelay={0} />);
    const next = () => fireEvent.click(screen.getByRole('button', { name: tr('games.chess.learn.next') }));
    next(); // meet
    for (const kind of ['rank', 'file', 'cross'] as const) {
      for (const [i, round] of coordRounds(kind).entries()) {
        await waitFor(() => expect(screen.getByTestId('coord-prompt').textContent).toContain(`${i + 1}/5`));
        click(squareName(round.square));
      }
      await waitFor(() => screen.getByRole('button', { name: tr('games.chess.learn.next') }));
      next();
    }
    // "find": the lines of the answer are hidden...
    expect(document.querySelectorAll('.ch-rank-line')).toHaveLength(0);
    expect(document.querySelectorAll('.ch-file-line')).toHaveLength(0);
    // ...and drawn after Hint: one row and one column.
    fireEvent.click(screen.getByRole('button', { name: tr('games.chess.learn.hint') }));
    expect(document.querySelectorAll('.ch-rank-line')).toHaveLength(8);
    expect(document.querySelectorAll('.ch-file-line')).toHaveLength(8);
  });
});
