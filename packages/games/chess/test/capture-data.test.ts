import { describe, expect, it } from 'vitest';
import { fromFen, inCheck, legalMoves } from '../src/rules/board';
import {
  ATTACKED_ROUNDS,
  attackers,
  capturable,
  captures,
  isSafeCapture,
  PIECE_VALUE,
  recapturers,
  SAFE_ROUNDS,
  TAKE_ROUNDS,
  toMove,
  VALUE_ROUNDS,
} from '../src/learn/capture';

describe('capture lesson data', () => {
  it('take rounds: White to move, nobody in check, and there is something to take', () => {
    for (const { fen } of TAKE_ROUNDS) {
      const pos = fromFen(fen);
      expect(pos.turn, fen).toBe('w');
      expect(inCheck(pos.board, 'w') || inCheck(pos.board, 'b'), fen).toBe(false);
      expect(captures(pos).length, fen).toBeGreaterThan(0);
      // The lesson asks for a capture, so there is also at least one plain move to refuse.
      expect(legalMoves(pos).length, fen).toBeGreaterThan(captures(pos).length);
    }
    // The last round offers a choice of two.
    expect(captures(fromFen(TAKE_ROUNDS[4]!.fen))).toHaveLength(2);
  });

  it('attacked rounds: Black to move, one white piece in danger and another that is safe', () => {
    for (const { fen } of ATTACKED_ROUNDS) {
      const pos = fromFen(fen);
      expect(pos.turn, fen).toBe('b');
      expect(inCheck(pos.board, 'w') || inCheck(pos.board, 'b'), fen).toBe(false);
      const danger = capturable(pos);
      expect(danger, fen).toHaveLength(1);
      expect(pos.board[danger[0]!]?.[1], fen).not.toBe('K');
      // At least one white piece other than the king is left alone.
      const safe = pos.board.flatMap((p, s) =>
        p && p[0] === 'w' && p[1] !== 'K' && !danger.includes(s) ? [s] : [],
      );
      expect(safe.length, fen).toBeGreaterThan(0);
    }
  });

  it('safe rounds: the capture is legal, and "safe" matches what Black can take back', () => {
    const verdicts = SAFE_ROUNDS.map((round) => {
      const pos = fromFen(round.fen);
      const move = toMove(round);
      expect(pos.turn, round.fen).toBe('w');
      expect(inCheck(pos.board, 'b'), round.fen).toBe(false);
      expect(
        legalMoves(pos).some((m) => m.from === move.from && m.to === move.to),
        round.fen,
      ).toBe(true);
      expect(pos.board[move.to]?.[0], round.fen).toBe('b');
      return isSafeCapture(pos, move);
    });
    // Three free, three guarded: the child must tell them apart.
    expect(verdicts.filter(Boolean)).toHaveLength(3);
    expect(verdicts.filter((v) => !v)).toHaveLength(3);
    // Guarded ones name who takes back.
    const guarded = SAFE_ROUNDS.filter((_, i) => !verdicts[i]);
    for (const round of guarded)
      expect(recapturers(fromFen(round.fen), toMove(round)).length).toBeGreaterThan(0);
  });

  it('value rounds: every pair has a clear winner', () => {
    for (const { left, right } of VALUE_ROUNDS) {
      expect(PIECE_VALUE[left], `${left} ${right}`).not.toBe(PIECE_VALUE[right]);
    }
    expect(attackers(fromFen(TAKE_ROUNDS[0]!.fen))).toHaveLength(1);
  });
});
