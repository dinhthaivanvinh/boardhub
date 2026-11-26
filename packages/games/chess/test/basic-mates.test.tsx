// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import vi from '../src/i18n/vi.json';
import { fromFen, kingSquare, legalMoves, makeMove, squareName } from '../src/rules/board';
import type { ChessMove } from '../src/rules/types';
import { matingMoves } from '../src/learn/checkmate';
import {
  BASIC_MATES_LESSON_ID,
  defenderMove,
  judgeMateMove,
  type MateDrill,
  MATE_DRILLS,
  mateTip,
  ROOK_CHALLENGE,
} from '../src/learn/basic-mates';
import { BasicMatesLesson } from '../src/learn/BasicMatesLesson';
import { LESSON_IDS } from '../src/learn/data';
import { parseMove } from '../src/learn/logic';

afterEach(cleanup);

/**
 * One way to win each drill against the defender (found by searching): the drill can always be finished. If the
 * defender changes, these lines have to be found again.
 */
const WINS: Record<string, string[]> = {
  rooks: ['a1a4', 'h1h6', 'a4a7', 'h6h8'],
  queen: ['d1d7', 'd7d5', 'd5g5', 'e1f2', 'g5g3'],
  rook: ['a1a5', 'a5f5', 'f5c5', 'e1d2', 'c5c4', 'c4c3', 'd2c1', 'c3a3'],
};

const run = (drill: MateDrill, line: string[]) => {
  let pos = fromFen(drill.fen);
  return line.map((text) => {
    const step = judgeMateMove(pos, parseMove(text));
    pos = makeMove(pos, parseMove(text));
    if (step.kind === 'goOn') pos = makeMove(pos, step.reply);
    return step.kind;
  });
};

describe('mating a lone king: the rules of the drills', () => {
  it('every drill can be won against the defender', () => {
    for (const drill of [...MATE_DRILLS, ROOK_CHALLENGE]) {
      const kinds = run(drill, WINS[drill.id]!);
      expect(kinds.at(-1), drill.id).toBe('mate');
      expect(kinds.slice(0, -1).every((k) => k === 'goOn')).toBe(true);
      expect(WINS[drill.id]!.length).toBeLessThan(drill.limit);
    }
  });

  it('takes an unguarded piece, and tells a draw by stalemate', () => {
    // The queen lands next to the king with nothing guarding it.
    const drop = judgeMateMove(fromFen('8/8/8/4k3/8/8/8/3QK3 w - -'), parseMove('d1d5'));
    expect(drop.kind).toBe('lost');
    const stale = judgeMateMove(fromFen('k7/8/8/2Q5/8/8/8/4K3 w - -'), parseMove('c5c7'));
    expect(stale.kind).toBe('stalemate');
  });

  it('does not walk into a mate in one when it has another square', () => {
    const pos = fromFen('1k6/8/2K5/8/8/8/6Q1/8 b - -');
    const allowsMate = (m: ChessMove) => matingMoves(makeMove(pos, m)).length > 0;
    // The position offers both kinds of square.
    expect(legalMoves(pos).some(allowsMate)).toBe(true);
    expect(legalMoves(pos).some((m) => !allowsMate(m))).toBe(true);
    expect(allowsMate(defenderMove(pos)!)).toBe(false);
  });

  it('names the next part of the method', () => {
    expect(mateTip('queen', fromFen('8/8/8/4k3/8/8/8/3QK3 w - -'))).toBe('queenCage');
    expect(mateTip('queen', fromFen('4k3/8/8/8/8/8/8/3QK3 w - -'))).toBe('queenKing');
    expect(mateTip('queen', fromFen('4k3/8/4K3/8/8/8/8/3Q4 w - -'))).toBe('queenMate');
    expect(mateTip('rook', fromFen('8/8/8/4k3/8/8/8/R3K3 w - -'))).toBe('rookCut');
    expect(mateTip('rook', fromFen('4k3/8/8/8/8/8/8/R3K3 w - -'))).toBe('rookKing');
    expect(mateTip('rook', fromFen('4k3/8/4K3/8/8/8/8/R7 w - -'))).toBe('rookCheck');
  });
});

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
const tr = (key: string, values?: Record<string, string | number>) => {
  const text = get(vi, key.replace(/^games\.chess\./, ''));
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? ''));
};
const c = (key: string, values?: Record<string, string | number>) =>
  tr(`games.chess.learn.basic-mates.${key}`, values);
const at = (square: string) => document.querySelector(`[data-square="${square}"]`)!;
const pieceAt = (square: string) => at(square).getAttribute('data-piece');
const status = () => screen.getByRole('status').textContent;
const nextName = tr('games.chess.learn.next');
const next = () => fireEvent.click(screen.getByRole('button', { name: nextName }));
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

/** Plays White's move once the board takes it (the black king may still be moving). */
async function play(text: string) {
  const from = text.slice(0, 2);
  await waitFor(() => expect(button(c('restart')).disabled).toBe(false));
  fireEvent.click(at(from));
  fireEvent.click(at(text.slice(2, 4)));
}
const win = async (id: string) => {
  for (const text of WINS[id]!) await play(text);
  expect(status()).toBe(c('right'));
};
const finishDrill = async () => {
  await waitFor(() => screen.getByRole('button', { name: nextName }));
  next();
};

describe('BasicMatesLesson', () => {
  it('is finished after the two rooks and the queen; the rook is an extra', async () => {
    const done: string[] = [];
    render(<BasicMatesLesson t={tr} animate={false} advanceDelay={0} onComplete={(id) => done.push(id)} />);
    next();
    await win('rooks');
    await finishDrill();
    await win('queen');
    expect(done).toEqual([]);
    await finishDrill();
    expect(done).toEqual([BASIC_MATES_LESSON_ID]);
    expect(LESSON_IDS).toContain(BASIC_MATES_LESSON_ID);

    fireEvent.click(button(c('challenge')));
    await win('rook');
    await finishDrill();
    expect(button(c('challenge'))).toBeTruthy();
    expect(done).toEqual([BASIC_MATES_LESSON_ID]);
  });

  it('takes back only the move that drops a piece', async () => {
    render(<BasicMatesLesson t={tr} animate={false} advanceDelay={0} />);
    next();
    await win('rooks');
    await finishDrill();

    // The position after one good move and the king's answer, and a queen move that now drops the queen.
    const first = fromFen(MATE_DRILLS[1]!.fen);
    const opened = judgeMateMove(first, parseMove('d1d7'));
    if (opened.kind !== 'goOn') throw new Error('the opening move should go on');
    const pos = makeMove(makeMove(first, parseMove('d1d7')), opened.reply);
    const drop = legalMoves(pos).find((m) => judgeMateMove(pos, m).kind === 'lost')!;
    const king = squareName(kingSquare(pos.board, 'b'));

    await play('d1d7');
    await play(squareName(drop.from) + squareName(drop.to));
    expect(status()).toBe(c('lost'));
    // Only that move is taken back: the first one stays.
    await waitFor(() => expect(pieceAt(king)).toBe('bK'));
    await waitFor(() => expect(pieceAt(squareName(drop.from))).toBe(pos.board[drop.from]));
    expect(pieceAt('d1')).toBeNull();
  });

  it('hint: words when there is no mate yet, the squares when there is', async () => {
    render(<BasicMatesLesson t={tr} animate={false} advanceDelay={0} />);
    next();
    const hint = () => button(tr('games.chess.learn.hint'));
    fireEvent.click(hint());
    expect(status()).toBe(c('tip.rooks'));
    expect(hint().disabled).toBe(true);
    for (const text of WINS.rooks!.slice(0, -1)) await play(text);
    await waitFor(() => expect(hint().disabled).toBe(false));
    fireEvent.click(hint());
    expect(status()).toBe(c('mateNow'));
    expect(hint().disabled).toBe(false);
  });
});
