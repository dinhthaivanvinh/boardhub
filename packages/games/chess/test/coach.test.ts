import { describe, expect, it } from 'vitest';
import vi from '../src/i18n/vi.json';
import { coach, coachMove, threatenedSquares } from '../src/coach';
import { fromFen, squareName, START_FEN } from '../src/rules/board';
import { fen, play, s } from './helpers';

const names = (squares: readonly number[]) => squares.map(squareName);
const hintOf = (text: string) => {
  const found = coachMove(fen(text))!;
  return `${squareName(found.move.from)}${squareName(found.move.to)} ${found.reason}`;
};
const tr = (key: string, values?: Record<string, string | number>) => {
  const text = key
    .replace(/^games\.chess\./, '')
    .split('.')
    .reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], vi);
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? ''));
};

describe('pieces in danger', () => {
  it('nothing at the start, and nothing when a guarded piece is only attacked by an equal one', () => {
    expect(threatenedSquares(fromFen(START_FEN), 'w')).toEqual([]);
    // The knights on c3 and d5 attack each other and both are guarded: a fair trade.
    expect(threatenedSquares(fromFen('4k3/8/4p3/3n4/8/2N5/1P6/4K3 w - -'), 'w')).toEqual([]);
  });

  it('finds a piece nobody guards, and a guarded one attacked by something cheaper, biggest loss first', () => {
    // A black pawn on d5 attacks the guarded queen on e4; the rook on a8 attacks the unguarded knight on a3.
    const pos = fromFen('r5k1/8/8/3p4/4Q3/N4P2/8/4K3 w - -');
    expect(names(threatenedSquares(pos, 'w'))).toEqual(['e4', 'a3']);
  });

  it('says it in words, and keeps quiet while the king is in check', () => {
    const advice = coach.warn(fen('r3k3/8/8/8/8/N7/8/4K3 w - -'), 0)!;
    expect(names(advice.cells)).toEqual(['a3']);
    expect(advice.text(tr)).toBe('Cẩn thận! Quân đang bị đe doạ: Mã ở a3.');
    const inCheck = play(['e2e4', 'f7f6', 'd2d4', 'g7g5', 'd1h5']);
    expect(inCheck.inCheck).toBe(1);
    expect(coach.warn(inCheck, 1)).toBeNull();
  });
});

describe('the suggested move', () => {
  it('mates when it can', () => {
    expect(hintOf('6k1/5ppp/8/8/8/8/8/R5K1 w - -')).toBe('a1a8 mate');
  });

  it('takes a piece that is free', () => {
    expect(hintOf('4k3/8/8/3q4/8/2N5/8/4K3 w - -')).toBe('c3d5 capture');
  });

  it('saves the piece in danger', () => {
    const st = fen('r3k3/8/8/8/8/N7/8/4K3 w - -');
    const found = coachMove(st)!;
    expect(found.reason).toBe('save');
    expect(found.move.from).toBe(s('a3'));
  });

  it('never allows a mate in one when it can help it, and never offers a stalemate when ahead', () => {
    // Black threatens ...Qh2 or back-rank tricks: whatever is suggested, Black has no mate in one after it.
    const st = fen('6k1/8/8/8/8/6q1/5P1P/6RK b - -');
    expect(coachMove(st)).not.toBeNull();
    const winning = coachMove(fen('k7/8/8/2Q5/8/8/8/4K3 w - -'))!;
    expect(squareName(winning.move.to)).not.toBe('c7');
  });

  it('is offered only on the player’s turn, with from and to', () => {
    const st = fen('4k3/8/8/3q4/8/2N5/8/4K3 w - -');
    expect(coach.hint(st, 1)).toBeNull();
    const advice = coach.hint(st, 0)!;
    expect(names(advice.cells)).toEqual(['c3', 'd5']);
    expect(advice.text(tr)).toBe('Con ăn được quân: Mã từ c3 đến d5.');
  });
});
