// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { squareOf } from '../src/rules/board';
import en from '../src/i18n/en.json';
import vi from '../src/i18n/vi.json';
import { OPENING_LESSONS, PIECE_LESSONS } from '../src/learn/data';
import { challengePosition, demoPosition, movesFrom, positionsOf, targetsFrom } from '../src/learn/logic';
import { spellSquares } from '../src/learn/speech';
import { markDone, PROGRESS_KEY, readProgress } from '../src/learn/progress';
import { OpeningLesson } from '../src/learn/OpeningLesson';
import { PieceLesson } from '../src/learn/PieceLesson';

afterEach(cleanup);

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
const flat = (obj: unknown, prefix = ''): string[] =>
  Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

/** Reads real text from the Vietnamese file so tests also catch missing keys. */
const tr = (key: string, values?: Record<string, string | number>) => {
  const path = key.replace(/^games\.chess\./, '');
  const text = get(vi, path);
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? ''));
};

describe('piece lessons data', () => {
  for (const lesson of PIECE_LESSONS) {
    it(`${lesson.id}: the piece can move and the challenge goal is reachable`, () => {
      const demo = demoPosition(lesson);
      const from = squareOf(lesson.from);
      expect(demo.board[from]).toBe(`w${lesson.piece}`);
      expect(targetsFrom(demo, from).length).toBeGreaterThan(0);

      const ch = challengePosition(lesson);
      const cFrom = squareOf(lesson.challenge.from);
      expect(ch.board[cFrom]).toBe(`w${lesson.piece}`);
      expect(movesFrom(ch, cFrom).some((m) => m.to === squareOf(lesson.challenge.goal))).toBe(true);
      expect(ch.board[squareOf(lesson.challenge.goal)]?.[0]).toBe('b');
    });
  }
});

describe('opening lessons data', () => {
  for (const lesson of OPENING_LESSONS) {
    it(`${lesson.id}: every move is legal from the start position`, () => {
      expect(positionsOf(lesson)).toHaveLength(lesson.moves.length + 1);
    });
    it(`${lesson.id}: ends on the move of the child's opponent or the child (any), starts with White`, () => {
      expect(positionsOf(lesson)[0]!.turn).toBe('w');
    });
  }
});

describe('i18n', () => {
  it('has the same keys in vi and en', () => {
    expect(flat(en.learn).sort()).toEqual(flat(vi.learn).sort());
  });
  it('has text for every lesson and every ply', () => {
    for (const l of PIECE_LESSONS) {
      for (const k of ['meet', 'move', 'try', 'challenge', 'fun']) {
        expect(get(vi.learn.pieces, `${l.id}.${k}`), `${l.id}.${k}`).toBeTypeOf('string');
      }
    }
    for (const l of OPENING_LESSONS) {
      const o = get(vi.learn.openings, l.id);
      for (const k of ['name', 'intro', 'sum0', 'sum1', 'sum2', ...l.moves.map((_, i) => `s${i}`)]) {
        expect(get(o, k), `${l.id}.${k}`).toBeTypeOf('string');
      }
    }
  });
});

describe('progress', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  it('remembers finished lessons and survives broken storage', () => {
    const store = memory();
    expect(markDone(store, 'rook').has('rook')).toBe(true);
    expect(markDone(store, 'pawn').size).toBe(2);
    expect(readProgress(store).has('rook')).toBe(true);
    store.setItem(PROGRESS_KEY, '{oops');
    expect(readProgress(store).size).toBe(0);
    expect(readProgress(null).size).toBe(0);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => markDone(throwing, 'rook')).not.toThrow();
  });
});

const click = (square: string) => fireEvent.click(document.querySelector(`[data-square="${square}"]`)!);

describe('PieceLesson', () => {
  it('walks through meet, watch, try and challenge and reports completion', () => {
    const done: string[] = [];
    const lesson = PIECE_LESSONS.find((l) => l.id === 'knight')!;
    render(<PieceLesson lesson={lesson} t={tr} animate={false} onComplete={(id) => done.push(id)} />);

    const next = () => fireEvent.click(screen.getByRole('button', { name: tr('games.chess.learn.next') }));
    next(); // meet -> watch
    next(); // watch -> try

    click('a1'); // not a knight square: no progress, shown message
    expect(screen.getByRole('status').textContent).toContain(tr('games.chess.learn.tryWrong'));
    for (const sq of ['b5', 'c6', 'e6', 'f5']) click(sq);
    expect(screen.getByRole('status').textContent).toBe(tr('games.chess.learn.tryDone'));
    next(); // try -> challenge

    click('d4');
    click('f3'); // legal but not the goal
    expect(screen.getByRole('status').textContent).toBe(tr('games.chess.learn.challengeNotGoal'));
    click('b5');
    expect(screen.getByRole('status').textContent).toBe(tr('games.chess.learn.challengeWon'));
    expect(done).toEqual([]);
    next(); // challenge -> done
    expect(done).toEqual(['knight']);
  });
});

describe('OpeningLesson', () => {
  it('only accepts the move of the lesson, then the opponent answers', async () => {
    const lesson = OPENING_LESSONS.find((l) => l.id === 'italian')!;
    const done: string[] = [];
    render(
      <OpeningLesson
        lesson={lesson}
        t={tr}
        animate={false}
        opponentDelay={0}
        onComplete={(id) => done.push(id)}
      />,
    );
    click('d2');
    click('d4'); // legal, but the lesson wants e4
    expect(
      screen.getAllByRole('status').some((e) => e.textContent === tr('games.chess.learn.wrongMove')),
    ).toBe(true);
    expect(document.querySelector('[data-square="d2"]')!.getAttribute('data-piece')).toBe('wP');

    click('e2');
    click('e4');
    await waitFor(() =>
      expect(document.querySelector('[data-square="e5"]')!.getAttribute('data-piece')).toBe('bP'),
    );
  });

  it('plays a whole line and shows the summary', async () => {
    const lesson = OPENING_LESSONS.find((l) => l.id === 'sicilian')!;
    const done: string[] = [];
    render(
      <OpeningLesson
        lesson={lesson}
        t={tr}
        animate={false}
        opponentDelay={0}
        onComplete={(id) => done.push(id)}
      />,
    );
    const moves = lesson.moves;
    for (let i = 0; i < moves.length; i++) {
      if (i % 2 === 0) continue; // White's moves are played by the lesson
      const m = moves[i]!;
      // wait until White's previous move is on the board, i.e. it is the child's turn
      const prev = moves[i - 1]!.slice(2, 4);
      await waitFor(() =>
        expect(document.querySelector(`[data-square="${prev}"]`)!.getAttribute('data-piece')).toMatch(/^w/),
      );
      click(m.slice(0, 2));
      click(m.slice(2, 4));
    }
    await waitFor(() => expect(screen.getByText(tr('games.chess.learn.remember'))).toBeTruthy());
    expect(done).toEqual(['sicilian']);
  });
});

describe('speech', () => {
  it('reads d3 and g3 differently in Vietnamese', () => {
    expect(spellSquares('đi d3', 'vi')).toBe('đi đê 3');
    expect(spellSquares('đi g3', 'vi')).toBe('đi giê 3');
    expect(spellSquares('tốt (e4), ô c5.', 'vi')).toBe('tốt (e 4), ô xê 5.');
    expect(spellSquares('go to g3', 'en')).toBe('go to g 3');
  });
});
