import { describe, expect, it } from 'vitest';
import { describe as describeMove, fromFen, inCheck, legalMoves, squareOf } from '../src/rules/board';
import { CAPTURE_LESSON_ID } from '../src/learn/capture';
import { OPENING_LESSONS, PIECE_LESSONS, SPECIAL_LESSONS } from '../src/learn/data';
import { PIECE_PRACTICE } from '../src/learn/practice-data';
import {
  PRACTICE_LESSON_IDS,
  practiceId,
  practicePosition,
  practiceRounds,
  type MoveRound,
} from '../src/learn/practice';

const types = ['P', 'R', 'B', 'N', 'Q', 'K'] as const;

describe('practice positions of the pieces', () => {
  for (const type of types) {
    it(`${type}: every star position has exactly one piece that can reach it, and it is the answer`, () => {
      expect(PIECE_PRACTICE[type].star.length).toBeGreaterThanOrEqual(3);
      for (const { fen, star, answer } of PIECE_PRACTICE[type].star) {
        const pos = fromFen(fen);
        expect(pos.turn, fen).toBe('w');
        expect(inCheck(pos.board, 'w') || inCheck(pos.board, 'b'), fen).toBe(false);
        expect(pos.board.filter((p) => p === 'wK').length, fen).toBe(1);
        expect(pos.board[squareOf(star)], `${fen} star is empty`).toBeNull();
        expect(pos.board[squareOf(answer)]?.[1], `${fen} answer is the piece of the lesson`).toBe(type);
        const reachers = new Set(
          legalMoves(pos)
            .filter((m) => m.to === squareOf(star))
            .map((m) => m.from),
        );
        expect([...reachers], fen).toEqual([squareOf(answer)]);
      }
    });

    it(`${type}: every capture position has exactly one capture, made by the piece of the lesson`, () => {
      expect(PIECE_PRACTICE[type].capture.length).toBeGreaterThanOrEqual(3);
      for (const { fen, from, to } of PIECE_PRACTICE[type].capture) {
        const pos = fromFen(fen);
        expect(inCheck(pos.board, 'w') || inCheck(pos.board, 'b'), fen).toBe(false);
        const captures = legalMoves(pos).filter((m) => pos.board[m.to]);
        expect(captures, fen).toHaveLength(1);
        expect(captures[0]!.from, fen).toBe(squareOf(from));
        expect(captures[0]!.to, fen).toBe(squareOf(to));
        expect(pos.board[squareOf(from)]?.[1], fen).toBe(type);
        expect(describeMove(pos, captures[0]!).captured, fen).not.toBeNull();
      }
    });
  }
});

describe('practice rounds of the lessons', () => {
  it('every lesson that has a practice gives 5 or 6 rounds, and the others give none', () => {
    for (const id of PRACTICE_LESSON_IDS) {
      const rounds = practiceRounds(id);
      expect(rounds, id).not.toBeNull();
      expect(rounds!.length, id).toBeGreaterThanOrEqual(5);
      expect(rounds!.length, id).toBeLessThanOrEqual(6);
    }
    for (const id of ['coordinates', 'checkmate', 'tactics', 'nope'])
      expect(practiceRounds(id), id).toBeNull();
    expect(PRACTICE_LESSON_IDS).toHaveLength(
      PIECE_LESSONS.length + 1 + OPENING_LESSONS.length + SPECIAL_LESSONS.length,
    );
  });

  it('every move round: the move is legal in its position, for the side to move', () => {
    for (const id of PRACTICE_LESSON_IDS) {
      for (const round of practiceRounds(id)!) {
        if (round.kind !== 'move') continue;
        const pos = practicePosition(round);
        const ok = legalMoves(pos).some(
          (m) => m.from === squareOf(round.from) && m.to === squareOf(round.to),
        );
        expect(ok, `${id}: ${round.from}${round.to}`).toBe(true);
      }
    }
  });

  it('opening rounds ask the child for their own moves, in the order of the line', () => {
    for (const lesson of OPENING_LESSONS) {
      const rounds = practiceRounds(lesson.id) as MoveRound[];
      const plies = rounds.map((r) => ('opening' in r.source ? r.source.ply : -1));
      expect(plies, lesson.id).toEqual([...plies].sort((a, b) => a - b));
      for (const r of rounds) {
        expect(practicePosition(r).turn, lesson.id).toBe(lesson.side);
        if ('opening' in r.source) expect(lesson.moves[r.source.ply], lesson.id).toBe(`${r.from}${r.to}`);
      }
    }
  });

  it('special-move rounds really are the special move', () => {
    const kingTwo = (r: MoveRound) => Math.abs(squareOf(r.from) - squareOf(r.to)) === 2;
    for (const r of practiceRounds('castling')! as MoveRound[]) {
      const pos = practicePosition(r);
      expect(pos.board[squareOf(r.from)], r.from).toBe('wK');
      expect(kingTwo(r)).toBe(true);
    }
    for (const r of practiceRounds('en-passant')! as MoveRound[]) {
      const pos = practicePosition(r);
      expect(pos.enPassant, r.to).toBe(squareOf(r.to));
      expect(pos.board[squareOf(r.to)]).toBeNull();
    }
    for (const r of practiceRounds('promotion')! as MoveRound[]) {
      const pos = practicePosition(r);
      const moves = legalMoves(pos).filter((m) => m.from === squareOf(r.from) && m.to === squareOf(r.to));
      expect(
        moves.every((m) => m.promotion),
        r.from,
      ).toBe(true);
      expect(
        moves.some((m) => m.promotion === 'Q'),
        r.from,
      ).toBe(true);
    }
  });

  it('the capture lesson practises five different pieces', () => {
    const rounds = practiceRounds(CAPTURE_LESSON_ID) as MoveRound[];
    expect(new Set(rounds.map((r) => (r.prompt.key === 'capture' ? r.prompt.piece : ''))).size).toBe(5);
  });

  it('a finished practice is remembered under its own id', () => {
    expect(practiceId('rook')).toBe('practice-rook');
    expect(practiceId('queens-gambit')).toMatch(/^[a-z0-9-]{1,40}$/);
  });
});
