// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import vi from '../src/i18n/vi.json';
import { squareName, squareOf } from '../src/rules/board';
import type { ChessMove, ChessState } from '../src/rules/types';
import { GameReview } from '../src/learn/GameReview';
import { parseMove } from '../src/learn/logic';
import { judgePlayed, type Moment, pickMoments, putsRight } from '../src/review';
import { fen, play } from './helpers';

afterEach(cleanup);

const judge = (position: string, move: string) => judgePlayed(fen(position), parseMove(move));

describe('what is worth another look', () => {
  it('a mate in one that was missed, and accepts only a mate on the new try', () => {
    const st = fen('6k1/5ppp/8/8/8/8/8/R5K1 w - -');
    const m = judgePlayed(st, parseMove('g1f1'))!;
    expect(m.kind).toBe('missedMate');
    expect(m.better).toEqual(parseMove('a1a8'));
    expect(putsRight(st, m, parseMove('a1a8'))).toBe(true);
    expect(putsRight(st, m, parseMove('a1a7'))).toBe(false);
    expect(judgePlayed(st, parseMove('a1a8'))).toBeNull();
  });

  it('a move that lets the other side mate, with the mate as the answer', () => {
    // After ...Nf6?? White mates on f7.
    const st = play(['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5']);
    const m = judgePlayed(st, parseMove('g8f6'))!;
    expect(m.kind).toBe('allowedMate');
    expect(m.reply).toEqual(parseMove('h5f7'));
    expect(putsRight(st, m, parseMove('g7g6'))).toBe(true);
    expect(putsRight(st, m, parseMove('a7a6'))).toBe(false);
  });

  it('a piece put where it is taken, naming it', () => {
    const st = fen('r5k1/8/8/8/8/8/8/1N4K1 w - -');
    const m = judgePlayed(st, parseMove('b1a3'))!;
    expect(m.kind).toBe('hung');
    expect(m.square).toBe(squareOf('a3'));
    expect(m.reply).toEqual(parseMove('a8a3'));
    expect(putsRight(st, m, parseMove('b1d2'))).toBe(true);
    expect(putsRight(st, m, parseMove('b1a3'))).toBe(false);
  });

  it('a free piece that was not taken', () => {
    const st = fen('4k3/8/8/3q4/8/2N5/8/4K3 w - -');
    const m = judgePlayed(st, parseMove('e1e2'))!;
    // The knight is also in the queen's line, so either way it is about not taking the queen.
    expect(['missedFree', 'hung']).toContain(m.kind);
    expect(m.better).toEqual(parseMove('c3d5'));
    expect(putsRight(st, m, parseMove('c3d5'))).toBe(true);
    const quiet = fen('4k3/8/8/6b1/8/5N2/PPP5/4K3 w - -');
    const missed = judgePlayed(quiet, parseMove('a2a3'))!;
    expect(missed.kind).toBe('missedFree');
    expect(missed.square).toBe(squareOf('g5'));
  });

  it('a stalemate given while ahead', () => {
    const st = fen('k7/8/8/2Q5/8/8/8/4K3 w - -');
    const m = judgePlayed(st, parseMove('c5c7'))!;
    expect(m.kind).toBe('stalemate');
    expect(putsRight(st, m, m.better)).toBe(true);
    expect(putsRight(st, m, parseMove('c5c7'))).toBe(false);
  });

  it('says nothing about sensible moves, a fair trade, or a single pawn', () => {
    const start = fen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -');
    expect(judgePlayed(start, parseMove('e2e4'))).toBeNull();
    expect(judge('4k3/8/4p3/3n4/8/2N5/1P6/4K3 w - -', 'c3d5')).toBeNull();
    // A pawn pushed where it is simply taken: not pointed out.
    expect(judge('4k3/8/8/3p4/8/8/4P3/4K3 w - -', 'e2e4')).toBeNull();
  });

  it('shows at most two moments, the weightiest, in the order they happened', () => {
    const base = judge('r5k1/8/8/8/8/8/8/1N4K1 w - -', 'b1a3')!;
    const at = (weight: number, moveNumber: number): Moment => ({
      ...base,
      weight,
      moveNumber,
      state: {} as ChessState,
    });
    const picked = pickMoments([at(3, 1), at(100, 2), at(5, 3), at(9, 4)]);
    expect(picked.map((m) => m.moveNumber)).toEqual([2, 4]);
  });
});

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
const tr = (key: string, values?: Record<string, string | number>) => {
  const text = get(vi, key.replace(/^games\.chess\./, ''));
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? ''));
};
const c = (key: string) => tr(`games.chess.learn.review.${key}`);
const square = (name: string) => document.querySelector(`[data-square="${name}"]`)!;
const tap = (m: ChessMove) => {
  fireEvent.click(square(squareName(m.from)));
  fireEvent.click(square(squareName(m.to)));
};
const status = () => screen.getByRole('status').textContent;
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));

/** The states of a game from the start, and its moves. */
function game(line: string[]) {
  const states = [play([])];
  for (let i = 0; i < line.length; i++) states.push(play(line.slice(0, i + 1)));
  return { states, moves: line.map((text, i) => ({ seat: i % 2, move: parseMove(text) })) };
}

describe('GameReview', () => {
  const quickMate = ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'];

  it('shows the losing move of a quick mate to Black, and takes a better one', async () => {
    let closed = 0;
    render(<GameReview {...game(quickMate)} seat={1} t={tr} animate={false} onClose={() => closed++} />);
    await waitFor(() => screen.getByTestId('review-moment'));
    expect(screen.getByTestId('review-moment').textContent).toContain('1/1');
    expect(status()).toBe(c('kind.allowedMate'));

    press(c('show'));
    expect(status()).toBe(c('shownReply'));
    expect(square('f7').getAttribute('data-piece')).toBe('wQ');

    press(c('retry'));
    tap(parseMove('a7a6'));
    expect(status()).toBe(c('wrong'));
    press(tr('games.chess.learn.hint'));
    expect(status()).toMatch(/ở ô [a-h][1-8]/);
    tap(parseMove('g7g6'));
    expect(status()).toBe(c('right'));
    expect(square('g6').getAttribute('data-piece')).toBe('bP');

    press(c('again'));
    expect(status()).toBe(c('kind.allowedMate'));
    press(c('close'));
    expect(closed).toBe(1);
  });

  it('praises a game with nothing to point out, and says what it does not see', async () => {
    render(
      <GameReview {...game(['e2e4', 'e7e5', 'g1f3'])} seat={0} t={tr} animate={false} onClose={() => {}} />,
    );
    await waitFor(() => expect(status()).toBe(c('clean')));
    expect(document.body.textContent).toContain(c('limits'));
  });
});
