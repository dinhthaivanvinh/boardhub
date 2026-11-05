// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BOARD_SETTINGS } from '@bg/ui';
import { playMoves } from '@bg/engine/testing';
import { Board, PieceIcon } from '../src/ui/Board';
import { definition } from '../src/rules/definition';
import type { OAnQuanState } from '../src/rules/types';
import { position } from './helpers';

afterEach(cleanup);

const t = (key: string, values?: Record<string, string | number>) =>
  values
    ? `${key} ${Object.entries(values)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')}`
    : key;

function renderBoard(view: OAnQuanState, opts: { mySeat?: number | null; isMyTurn?: boolean } = {}) {
  const onMove = vi.fn();
  render(
    <Board
      view={view}
      mySeat={opts.mySeat === undefined ? 0 : opts.mySeat}
      isMyTurn={opts.isMyTurn ?? true}
      onMove={onMove}
      settings={DEFAULT_BOARD_SETTINGS}
      t={t}
    />,
  );
  return { onMove };
}

const start = () => playMoves(definition, {}, []);
const cell = (i: number) => document.querySelector(`[data-cell="${i}"]`) as HTMLElement;
/** On-screen order of the squares in each row, left to right. */
const row = (n: 0 | 1) =>
  [...document.querySelectorAll('.oaq-row')[n]!.querySelectorAll('[data-cell]')].map((e) =>
    Number(e.getAttribute('data-cell')),
  );

describe('Ô ăn quan board', () => {
  it('your row is at the bottom, the ring runs round the table', () => {
    renderBoard(start());
    expect(row(1)).toEqual([1, 2, 3, 4, 5]);
    expect(row(0)).toEqual([11, 10, 9, 8, 7]);
    expect(cell(0).classList.contains('oaq-quan-left')).toBe(true);
    expect(cell(6).getAttribute('data-quan')).toBe('true');
    expect(screen.getAllByRole('button', { name: /games\.o-an-quan\.square/ })).toHaveLength(10);
  });

  it('turns round for side 2', () => {
    renderBoard(start(), { mySeat: 1, isMyTurn: false });
    expect(row(1)).toEqual([7, 8, 9, 10, 11]);
    expect(row(0)).toEqual([5, 4, 3, 2, 1]);
    expect(cell(6).classList.contains('oaq-quan-left')).toBe(true);
  });

  it('pick a square, then a direction', () => {
    const { onMove } = renderBoard(start());
    fireEvent.click(cell(3));
    expect(cell(3).getAttribute('data-selected')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /games\.o-an-quan\.right/ }));
    expect(onMove).toHaveBeenCalledWith({ cell: 3, dir: 1 });
    fireEvent.click(cell(2));
    fireEvent.click(screen.getByRole('button', { name: /games\.o-an-quan\.left/ }));
    expect(onMove).toHaveBeenLastCalledWith({ cell: 2, dir: -1 });
  });

  it('hot-seat: side 2 plays from the top row, and "right" means right on screen', () => {
    const onMove = vi.fn();
    render(
      <Board
        view={{ ...start(), turn: 1 }}
        mySeat={1}
        isMyTurn
        orientation={0}
        onMove={onMove}
        settings={DEFAULT_BOARD_SETTINGS}
        t={t}
      />,
    );
    expect(row(0)).toEqual([11, 10, 9, 8, 7]);
    fireEvent.click(cell(9));
    fireEvent.click(screen.getByRole('button', { name: /games\.o-an-quan\.right/ }));
    // On the top row, screen-right goes from 9 towards 8: the ring's -1 direction.
    expect(onMove).toHaveBeenCalledWith({ cell: 9, dir: -1 });
  });

  it('cancel, and clicking the square again, both deselect', () => {
    renderBoard(start());
    fireEvent.click(cell(3));
    fireEvent.click(screen.getByRole('button', { name: 'games.o-an-quan.cancel' }));
    expect(cell(3).getAttribute('data-selected')).toBeNull();
    fireEvent.click(cell(4));
    fireEvent.click(cell(4));
    expect(screen.queryByRole('button', { name: /games\.o-an-quan\.right/ })).toBeNull();
  });

  it('cannot pick an opponent square, an empty one, or play out of turn', () => {
    renderBoard(position([0, 0, 5, 5, 5, 5, 0, 5, 5, 5, 5, 5]));
    fireEvent.click(cell(8));
    fireEvent.click(cell(1));
    expect(screen.queryByRole('button', { name: /games\.o-an-quan\.right/ })).toBeNull();
    cleanup();
    renderBoard(start(), { isMyTurn: false });
    fireEvent.click(cell(3));
    expect(cell(3).getAttribute('data-selected')).toBeNull();
    cleanup();
    renderBoard(start(), { mySeat: null, isMyTurn: false });
    expect(screen.getByTestId('stash-bottom').textContent).toContain('games.o-an-quan.pieces.0');
  });

  it('shows the last move, captures, scores and a refill', () => {
    const s = position([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0], {
      stash: [
        { dan: 10, quan: 0 },
        { dan: 2, quan: 0 },
      ],
    });
    const after = definition.applyMove(s, 0, { cell: 3, dir: 1 }, { rng: undefined as never });
    renderBoard(after, { mySeat: 0, isMyTurn: false });
    expect(cell(3).getAttribute('data-start')).toBe('true');
    expect(cell(6).getAttribute('data-taken')).toBe('true');
    expect(screen.getByTestId('stash-bottom').textContent).toContain('games.o-an-quan.points n=21');
    expect(screen.getByTestId('stash-top').textContent).toContain('games.o-an-quan.debt n=3');
    expect(screen.getAllByText(/games\.o-an-quan\.refillBorrowed/).length).toBeGreaterThan(0);
    expect(screen.getByText(/games\.o-an-quan\.took n=1/)).toBeTruthy();
  });

  it('PieceIcon draws each side', () => {
    const { container } = render(
      <>
        <PieceIcon seat={0} />
        <PieceIcon seat={1} />
      </>,
    );
    expect(container.querySelectorAll('.oaq-icon-p0')).toHaveLength(1);
    expect(container.querySelectorAll('.oaq-icon-p1')).toHaveLength(1);
  });
});
