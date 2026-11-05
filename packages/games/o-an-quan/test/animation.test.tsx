// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BOARD_SETTINGS } from '@bg/ui';
import { playMoves, randomPlayout } from '@bg/engine/testing';
import { definition } from '../src/rules/definition';
import { sow } from '../src/rules/rules';
import type { OAnQuanMove, OAnQuanState } from '../src/rules/types';
import { frameDelay, sowFrames } from '../src/ui/animation';
import { Board } from '../src/ui/Board';

const ctx = { rng: undefined as never };
const start = () => playMoves(definition, {}, []);
const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key} ${Object.values(values).join(' ')}` : key;

describe('sowing frames', () => {
  it('the first move, step by step', () => {
    const { events } = sow(start(), 0, { cell: 1, dir: 1 });
    expect(events.map((e) => `${e.kind}:${e.cell}`)).toEqual([
      'pick:1',
      ...[2, 3, 4, 5, 6].map((c) => `drop:${c}`),
      'pick:7',
      ...[8, 9, 10, 11, 0].map((c) => `drop:${c}`),
      'take:2',
    ]);
    const frames = sowFrames(start(), { cell: 1, dir: 1 });
    expect(frames[0]).toMatchObject({ hand: 5, active: 1, event: 'pick', start: 1 });
    expect(frames[1]).toMatchObject({ hand: 4, active: 2, event: 'drop' });
    expect(frames[1]!.cells[2]).toBe(6);
    expect(frames.at(-1)).toMatchObject({ event: 'take', active: 2, taken: [2] });
  });

  it('always ends exactly where the rules end', () => {
    randomPlayout(definition, {}, 'frames', 400, {
      eachStep: (s: OAnQuanState) => {
        if (s.ended) return;
        for (const m of definition.legalMoves!(s, s.turn)) {
          const last = sowFrames(s, m).at(-1)!;
          const { cells, quan, stash } = sow(s, s.turn, m);
          expect(last.cells).toEqual(cells);
          expect(last.quan).toEqual(quan);
          expect(last.stash).toEqual(stash);
        }
      },
    });
  });

  it('long moves speed up, but never below 90 ms a step', () => {
    const f = sowFrames(start(), { cell: 1, dir: 1 })[1]!;
    expect(frameDelay(f, 10)).toBe(380);
    expect(frameDelay(f, 60)).toBeLessThan(380);
    expect(frameDelay(f, 1000)).toBe(90);
  });
});

describe('board playback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const board = (view: OAnQuanState, animations = true) => (
    <Board
      view={view}
      mySeat={0}
      isMyTurn
      onMove={() => {}}
      settings={{ ...DEFAULT_BOARD_SETTINGS, animations }}
      t={t}
    />
  );
  const count = (cell: number) => document.querySelector(`[data-cell="${cell}"]`)!.getAttribute('data-count');
  const move: OAnQuanMove = { cell: 1, dir: 1 };

  it('shows each stone landing, then the result; no moves while it plays', () => {
    const before = start();
    const after = definition.applyMove(before, 0, move, ctx);
    const { rerender } = render(board(before));
    rerender(board({ ...after, turn: 0 }));
    // First frame: square 1 picked up, 5 in hand.
    expect(count(1)).toBe('0');
    expect(screen.getByTestId('sowing-hand').textContent).toContain('5');
    expect(count(2)).toBe('5');
    fireEvent.click(document.querySelector('[data-cell="3"]')!);
    expect(document.querySelector('[data-selected="true"]')).toBeNull();

    act(() => vi.advanceTimersByTime(550));
    expect(count(2)).toBe('6');
    expect(screen.getByTestId('sowing-hand').textContent).toContain('4');

    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.queryByTestId('sowing-hand')).toBeNull();
    expect(count(2)).toBe('0');
    expect(document.querySelector('[data-cell="2"]')!.getAttribute('data-taken')).toBe('true');
  });

  it('a reply that arrives during the animation waits its turn', () => {
    const s0 = start();
    const s1 = definition.applyMove(s0, 0, move, ctx);
    const s2 = definition.applyMove(s1, 1, { cell: 9, dir: -1 }, ctx);
    const { rerender } = render(board(s0));
    rerender(board(s1));
    rerender(board(s2));
    act(() => vi.advanceTimersByTime(3_000));
    // Still on the first move: square 9 has not been picked up yet.
    expect(count(9)).not.toBe('0');
    act(() => vi.advanceTimersByTime(60_000));
    expect(count(9)).toBe('0');
    expect(screen.queryByTestId('sowing-hand')).toBeNull();
  });

  it('"Skip" jumps to the latest position', () => {
    const before = start();
    const after = definition.applyMove(before, 0, move, ctx);
    const { rerender } = render(board(before));
    rerender(board(after));
    fireEvent.click(screen.getByRole('button', { name: /games\.o-an-quan\.skip/ }));
    expect(count(2)).toBe('0');
    expect(screen.queryByTestId('sowing-hand')).toBeNull();
  });

  it('after "Skip", the move can be watched again stone by stone', () => {
    const before = start();
    const after = definition.applyMove(before, 0, move, ctx);
    const { rerender } = render(board(before));
    rerender(board(after));
    fireEvent.click(screen.getByRole('button', { name: /games.o-an-quan.skip/ }));
    fireEvent.click(screen.getByTestId('oaq-replay-move'));
    expect(screen.getByTestId('sowing-hand')).toBeTruthy();
    expect(count(1)).toBe('0');
    expect(count(2)).toBe('5');
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.queryByTestId('sowing-hand')).toBeNull();
    expect(count(2)).toBe('0');
    // Still offered, also when effects are off.
    expect(screen.getByTestId('oaq-replay-move')).toBeTruthy();
  });

  it('the speed can be changed while a move plays: slow takes twice as long, fast a third', () => {
    const before = start();
    const after = definition.applyMove(before, 0, move, ctx);
    const { rerender } = render(board(before));
    rerender(board(after));
    fireEvent.click(screen.getByTestId('oaq-speed-0.5'));
    expect(screen.getByTestId('oaq-speed-0.5').getAttribute('aria-pressed')).toBe('true');
    // The first frame was already scheduled at normal speed; the next one is twice as slow.
    act(() => vi.advanceTimersByTime(550));
    expect(count(2)).toBe('6');
    act(() => vi.advanceTimersByTime(700));
    expect(count(3)).toBe('5');
    act(() => vi.advanceTimersByTime(100));
    expect(count(3)).toBe('6');
    fireEvent.click(screen.getByTestId('oaq-speed-3'));
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.queryByTestId('sowing-hand')).toBeNull();
  });

  it('no animation when effects are off, or after an undo', () => {
    const before = start();
    const after = definition.applyMove(before, 0, move, ctx);
    const { rerender } = render(board(before, false));
    rerender(board(after, false));
    expect(screen.queryByTestId('sowing-hand')).toBeNull();
    expect(count(2)).toBe('0');
    rerender(board(before));
    expect(count(2)).toBe('5');
  });
});
