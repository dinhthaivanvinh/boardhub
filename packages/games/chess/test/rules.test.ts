import { describe, expect, it } from 'vitest';
import { insufficientMaterial } from '../src/rules/board';
import { definition } from '../src/rules/definition';
import { setup } from '../src/rules/rules';
import { fen, play, s, targetsOf } from './helpers';

describe('start', () => {
  it('White moves first with 20 moves; the game is on', () => {
    const st = setup({});
    expect(st.turn).toBe(0);
    expect(definition.legalMoves!(st, 0)).toHaveLength(20);
    expect(definition.legalMoves!(st, 1)).toEqual([]);
    expect(definition.result(st)).toBeNull();
    expect(st.board[s('e1')]).toBe('wK');
    expect(st.board[s('d8')]).toBe('bQ');
  });
});

describe('castling', () => {
  const open = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq -';

  it('both sides when the way is clear; the rook jumps over', () => {
    expect(targetsOf(fen(open), 'e1')).toEqual(['c1', 'd1', 'd2', 'e2', 'f1', 'f2', 'g1']);
    const k = play(['e1g1'], fen(open));
    expect(k.board[s('g1')]).toBe('wK');
    expect(k.board[s('f1')]).toBe('wR');
    expect(k.board[s('h1')]).toBeNull();
    expect(k.lastMove?.castle).toBe('K');
    expect(k.castling).toBe('kq');
    const q = play(['e1c1'], fen(open));
    expect(q.board[s('d1')]).toBe('wR');
    expect(q.lastMove?.castle).toBe('Q');
  });

  it('not out of check, through an attacked square, or into one', () => {
    // In check from a rook on e3: no castling at all.
    expect(targetsOf(fen('4k3/8/8/8/8/4r3/8/R3K2R w KQ -'), 'e1')).not.toContain('g1');
    expect(targetsOf(fen('4k3/8/8/8/8/4r3/8/R3K2R w KQ -'), 'e1')).not.toContain('c1');
    // A black rook on f8's file attacks f1: no castling through it; a rook on c-file stops queenside.
    const through = fen('5r2/8/8/8/8/8/8/R3K2R w KQ -');
    expect(targetsOf(through, 'e1')).not.toContain('g1');
    expect(targetsOf(through, 'e1')).toContain('c1');
    const into = fen('2r5/8/8/8/8/8/8/R3K2R w KQ -');
    expect(targetsOf(into, 'e1')).not.toContain('c1');
    // b1 may be attacked: only the king's path matters.
    expect(targetsOf(fen('1r6/8/8/8/8/8/8/R3K2R w KQ -'), 'e1')).toContain('c1');
  });

  it('rights are lost when the king or rook moves, or the rook is captured', () => {
    expect(play(['e1e2'], fen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq -')).castling).toBe('kq');
    expect(play(['h1h2'], fen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq -')).castling).toBe('Qkq');
    expect(play(['a1a8'], fen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq -')).castling).toBe('Kk');
  });
});

describe('en passant', () => {
  it('only right after the double step', () => {
    const st = play(['e2e4', 'a7a6', 'e4e5', 'd7d5']);
    expect(targetsOf(st, 'e5')).toContain('d6');
    const taken = play(['e5d6'], st);
    expect(taken.board[s('d5')]).toBeNull();
    expect(taken.lastMove).toMatchObject({ enPassant: true, captured: 'bP' });
    // One move later it is too late.
    expect(targetsOf(play(['h2h3', 'h7h6'], st), 'e5')).not.toContain('d6');
  });

  it('not when it would expose the king along the rank', () => {
    // White king a5, pawn b5; black pawn c7 → c5, black rook h5: taking would open the 5th rank.
    const st = play(['c7c5'], fen('8/2p5/8/KP5r/8/8/8/7k b - -'));
    expect(targetsOf(st, 'b5')).not.toContain('c6');
  });
});

describe('promotion', () => {
  const ready = '8/P7/8/8/8/8/8/k6K w - -';
  it('a pawn on the last rank must choose a piece; all four are allowed', () => {
    const st = fen(ready);
    expect(definition.validateMove(st, 0, { from: s('a7'), to: s('a8') })).toEqual({
      ok: false,
      code: 'chess.needs_promotion',
    });
    expect(definition.validateMove(st, 0, { from: s('h1'), to: s('h2'), promotion: 'Q' })).toEqual({
      ok: false,
      code: 'chess.needs_promotion',
    });
    for (const p of ['q', 'r', 'b', 'n']) {
      expect(play([`a7a8${p}`], st).board[s('a8')]).toBe(`w${p.toUpperCase()}`);
    }
    expect(play(['a7a8q'], st).lastMove?.promotion).toBe('Q');
  });
});

describe('validation', () => {
  const st = setup({});
  it.each([
    [{ from: -1, to: 0 }, 'chess.out_of_bounds'],
    [{ from: s('e4'), to: s('e5') }, 'chess.no_piece'],
    [{ from: s('e7'), to: s('e5') }, 'chess.not_your_piece'],
    [{ from: s('e2'), to: s('e5') }, 'chess.illegal_move'],
    [{ from: s('b1'), to: s('d2') }, 'chess.illegal_move'],
  ])('%o is rejected with %s', (move, code) => {
    expect(definition.validateMove(st, 0, move)).toEqual({ ok: false, code });
  });

  it('a pinned piece cannot leave the line to the king', () => {
    const pinned = fen('4k3/4r3/8/8/8/8/4B3/4K3 w - -');
    expect(definition.validateMove(pinned, 0, { from: s('e2'), to: s('d3') })).toEqual({
      ok: false,
      code: 'chess.self_check',
    });
  });
});

describe('end of the game', () => {
  it("scholar's mate: checkmate wins", () => {
    const st = play(['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7']);
    expect(st.status).toBe('checkmate');
    expect(st.inCheck).toBe(1);
    expect(definition.result(st)).toEqual({ kind: 'win', winners: [0], reason: 'checkmate' });
    expect(definition.activePlayers(st)).toEqual([]);
    expect(definition.legalMoves!(st, 1)).toEqual([]);
  });

  it('check without mate keeps the game going', () => {
    const st = play(['e2e4', 'f7f6', 'd1h5']);
    expect(st.inCheck).toBe(1);
    expect(st.status).toBe('playing');
  });

  it('stalemate is a draw', () => {
    // Queen to c7 leaves the black king on a8 with no move and not in check.
    const pat = play(['b6c7'], fen('k7/8/1Q6/8/8/8/8/7K w - -'));
    expect(pat.status).toBe('stalemate');
    expect(definition.result(pat)).toEqual({ kind: 'draw', reason: 'stalemate' });
  });

  it('the same position three times is a draw', () => {
    const st = play(['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']);
    expect(st.status).toBe('repetition');
    expect(definition.result(st)).toEqual({ kind: 'draw', reason: 'repetition' });
    expect(play(['g1f3', 'g8f6', 'f3g1', 'f6g8']).status).toBe('playing');
  });

  it('fifty moves each without a pawn move or capture is a draw', () => {
    const near = { ...fen('k7/8/8/8/8/8/1R6/K7 w - -'), halfmove: 99 };
    expect(play(['b2c2'], near).status).toBe('fifty_moves');
    expect(play(['b2c2'], { ...near, halfmove: 50 }).status).toBe('playing');
  });

  it('not enough material to mate is a draw', () => {
    expect(insufficientMaterial(fen('k7/8/8/8/8/8/8/K7 w - -').board)).toBe(true);
    expect(insufficientMaterial(fen('k7/8/8/8/8/8/8/KN6 w - -').board)).toBe(true);
    expect(insufficientMaterial(fen('k1b5/8/8/8/8/8/8/K1B5 w - -').board)).toBe(false); // opposite colours
    expect(insufficientMaterial(fen('k1b5/8/8/8/8/8/8/KB6 w - -').board)).toBe(true); // same colour
    expect(insufficientMaterial(fen('k7/8/8/8/8/8/8/KR6 w - -').board)).toBe(false);
    // The white king takes the last rook: king against king.
    const st = play(['a1b2'], fen('k7/8/8/8/8/8/1r6/K7 w - -'));
    expect(st.status).toBe('insufficient');
  });
});
