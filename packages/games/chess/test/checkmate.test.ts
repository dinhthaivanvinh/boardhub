import { describe, expect, it } from 'vitest';
import { fromFen, inCheck, legalMoves, makeMove, squareOf } from '../src/rules/board';
import {
  CHECK_ROUNDS,
  ESCAPE_ROUNDS,
  escapeReply,
  isCheckmate,
  isStalemate,
  JUDGE_ROUNDS,
  MATE_ROUNDS,
  matingMoves,
  rescueKind,
} from '../src/learn/checkmate';

describe('checkmate lesson data', () => {
  it('check rounds: White is in check and the named piece is the attacker', () => {
    for (const { fen, attacker } of CHECK_ROUNDS) {
      const pos = fromFen(fen);
      expect(pos.turn, fen).toBe('w');
      expect(inCheck(pos.board, 'w'), fen).toBe(true);
      const sq = squareOf(attacker);
      expect(pos.board[sq]?.[0], fen).toBe('b');
      // Taking the attacker off the board ends the check: it is the only one.
      const without = pos.board.map((p, i) => (i === sq ? null : p));
      expect(inCheck(without, 'w'), fen).toBe(false);
    }
  });

  it('escape rounds: White is in check and has a move of the asked kind', () => {
    for (const { fen, kind } of ESCAPE_ROUNDS) {
      const pos = fromFen(fen);
      expect(inCheck(pos.board, 'w'), fen).toBe(true);
      const kinds = new Set(legalMoves(pos).map((m) => rescueKind(pos, m)));
      expect(kinds.has(kind), `${fen} ${kind}`).toBe(true);
    }
    // The three rounds ask for the three different ways.
    expect(new Set(ESCAPE_ROUNDS.map((r) => r.kind)).size).toBe(3);
  });

  it('judge rounds: the lesson agrees with the engine about what is mate', () => {
    for (const { fen, mate } of JUDGE_ROUNDS) {
      const pos = fromFen(fen);
      expect(inCheck(pos.board, 'w'), fen).toBe(true);
      expect(isCheckmate(pos), fen).toBe(mate);
    }
    expect(JUDGE_ROUNDS.filter((r) => r.mate)).toHaveLength(3);
  });

  it('mate rounds: White has a mate in one, and Black is not already in check', () => {
    for (const { fen } of MATE_ROUNDS) {
      const pos = fromFen(fen);
      expect(pos.turn, fen).toBe('w');
      expect(inCheck(pos.board, 'b'), fen).toBe(false);
      const mates = matingMoves(pos);
      expect(mates.length, fen).toBeGreaterThan(0);
      for (const m of mates) expect(isStalemate(makeMove(pos, m))).toBe(false);
    }
  });

  it('classifies a rescue and picks a reply that is legal', () => {
    const [run, capture, block] = ESCAPE_ROUNDS.map((r) => fromFen(r.fen));
    const mv = (pos: ReturnType<typeof fromFen>, from: string, to: string) => ({
      from: squareOf(from),
      to: squareOf(to),
    });
    expect(rescueKind(run!, mv(run!, 'e1', 'd1'))).toBe('run');
    expect(rescueKind(capture!, mv(capture!, 'd6', 'e8'))).toBe('capture');
    expect(rescueKind(block!, mv(block!, 'c4', 'e2'))).toBe('block');

    // A mate that is not played: the king still has a reply, and it is a legal one.
    const pos = fromFen(MATE_ROUNDS[0]!.fen);
    const notMate = makeMove(pos, { from: squareOf('a1'), to: squareOf('a2') });
    const reply = escapeReply(notMate)!;
    expect(legalMoves(notMate).some((m) => m.from === reply.from && m.to === reply.to)).toBe(true);
  });
});
