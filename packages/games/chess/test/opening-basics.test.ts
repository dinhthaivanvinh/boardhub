import { describe, expect, it } from 'vitest';
import { fromFen, legalMoves, makeMove, squareName } from '../src/rules/board';
import type { ChessMove, Position } from '../src/rules/types';
import { isCheckmate, matingMoves } from '../src/learn/checkmate';
import { parseMove, playLine } from '../src/learn/logic';
import {
  CASTLE_ROUNDS,
  CENTER_ROUNDS,
  centerVerdict,
  CHOICE_ROUNDS,
  DEFEND_ROUNDS,
  defenceVerdict,
  DEVELOP_ROUNDS,
  developVerdict,
  goodMoves,
  isCastle,
  isGoodDefence,
  roundPosition,
  sameMove,
  SPOT_ROUNDS,
  TRAP_LINE,
  TRAP_SQUARE,
  trapFrames,
  winsMaterial,
} from '../src/learn/opening-basics';

const names = (moves: ChessMove[]) => moves.map((m) => squareName(m.from) + squareName(m.to));
const accepts = (pos: Position, judge: (p: Position, m: ChessMove) => boolean, text: string) =>
  goodMoves(pos, judge).some((m) => sameMove(m, parseMove(text)));

describe('the three opening ideas', () => {
  const center = (p: Position, m: ChessMove) => centerVerdict(p, m) === 'good';
  const develop = (p: Position, m: ChessMove) => developVerdict(p, m) === 'good';

  it('every hint is one of the accepted moves, and White is to move', () => {
    for (const r of CENTER_ROUNDS) expect(accepts(roundPosition(r), center, r.suggest)).toBe(true);
    for (const r of DEVELOP_ROUNDS) expect(accepts(roundPosition(r), develop, r.suggest)).toBe(true);
    for (const r of CASTLE_ROUNDS) expect(accepts(fromFen(r.fen), isCastle, r.suggest)).toBe(true);
    for (const r of [...CENTER_ROUNDS, ...DEVELOP_ROUNDS]) expect(roundPosition(r).turn).toBe('w');
  });

  it('accepts only pawns to d4 or e4 that are not lost', () => {
    expect(names(goodMoves(roundPosition(CENTER_ROUNDS[0]!), center)).sort()).toEqual(['d2d4', 'e2e4']);
    // 1.d4 d5 2.e4 simply gives the pawn away: nothing takes back.
    expect(centerVerdict(roundPosition({ line: ['d2d4', 'd7d5'] }), parseMove('e2e4'))).toBe('unsafe');
  });

  it('names what is wrong with a developing move', () => {
    const pos = roundPosition(DEVELOP_ROUNDS[1]!);
    expect(developVerdict(pos, parseMove('d2d3'))).toBe('notMinor');
    expect(developVerdict(pos, parseMove('f3g5'))).toBe('again');
    expect(developVerdict(pos, parseMove('f1a6'))).toBe('unsafe');
    expect(developVerdict(roundPosition(DEVELOP_ROUNDS[0]!), parseMove('g1h3'))).toBe('edge');
  });

  it('each choice has legal options and exactly one without a flaw', () => {
    for (const round of CHOICE_ROUNDS) {
      const legal = legalMoves(roundPosition(round));
      for (const o of round.options) expect(legal.some((m) => sameMove(m, parseMove(o.move)))).toBe(true);
      expect(round.options.filter((o) => o.flaw === null)).toHaveLength(1);
    }
  });

  it('the "gives it away" choice really loses material', () => {
    const round = CHOICE_ROUNDS.find((r) => r.options.some((o) => o.flaw === 'hang'))!;
    const hang = round.options.find((o) => o.flaw === 'hang')!;
    expect(winsMaterial(makeMove(roundPosition(round), parseMove(hang.move)))).not.toBeNull();
  });
});

describe('the four-move mate', () => {
  it('the trap ends in checkmate', () => {
    expect(isCheckmate(trapFrames().at(-1)!)).toBe(true);
  });

  it('f7 is the pawn both the queen and the bishop aim at', () => {
    for (const round of SPOT_ROUNDS) {
      const pos = roundPosition(round);
      const asWhite = { ...pos, turn: 'w' as const };
      const aimed = ['Q', 'B'].map((type) =>
        legalMoves(asWhite)
          .filter((m) => asWhite.board[m.from] === `w${type}` && asWhite.board[m.to] === 'bP')
          .map((m) => m.to),
      );
      expect(aimed[0]).toContain(TRAP_SQUARE);
      expect(aimed[1]).toContain(TRAP_SQUARE);
    }
  });

  it('in every defence round White threatens mate, and the hint stops it without losing anything', () => {
    for (const round of DEFEND_ROUNDS) {
      const pos = roundPosition(round);
      expect(pos.turn).toBe('b');
      expect(matingMoves({ ...pos, turn: 'w' }).length).toBeGreaterThan(0);
      expect(defenceVerdict(pos, parseMove(round.suggest))).toEqual({ kind: 'good' });
      for (const move of goodMoves(pos, isGoodDefence)) {
        expect(matingMoves(makeMove(pos, move))).toEqual([]);
      }
    }
  });

  it('tells a move that still allows mate from one that loses material', () => {
    const pos = roundPosition(DEFEND_ROUNDS[0]!);
    expect(defenceVerdict(pos, parseMove(TRAP_LINE[5]!)).kind).toBe('mate');
    // 3...d5 stops the mate but drops a pawn: after Bxd5 Black cannot take back without losing the queen.
    expect(defenceVerdict(pos, parseMove('d7d5')).kind).toBe('loses');
  });

  it('the whole line of the replay is legal', () => {
    expect(() => playLine('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -', TRAP_LINE)).not.toThrow();
  });
});
