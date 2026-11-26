import { colOf, describe, legalMoves, makeMove, squareName, squareOf, START_FEN } from '../rules/board';
import type { ChessMove, PieceType, Position } from '../rules/types';
import { PIECE_VALUE } from './capture';
import { matingMoves } from './checkmate';
import { playLine } from './logic';

/** "3 nguyên tắc mở đầu": the centre, bringing pieces out, a safe king. */
export const OPENING_BASICS_LESSON_ID = 'opening-basics';
/** "Coi chừng chiếu hết nhanh": defending against the four-move mate. */
export const EARLY_MATE_LESSON_ID = 'early-mate';

const after = (line: string[]): Position => {
  const frames = playLine(START_FEN, line);
  return frames[frames.length - 1]!;
};

/** The points a move takes off the board. */
const taken = (pos: Position, move: ChessMove): number => {
  const piece = describe(pos, move).captured;
  return piece ? PIECE_VALUE[piece[1] as PieceType] : 0;
};

/**
 * The points the side to move can win by trading on `square`, counting the whole exchange: each side takes back
 * only while that pays.
 */
function exchangeGain(pos: Position, square: number): number {
  let best = 0;
  for (const m of legalMoves(pos)) {
    if (m.to !== square) continue;
    best = Math.max(best, taken(pos, m) - exchangeGain(makeMove(pos, m), square));
  }
  return best;
}

/** Whether the piece that just moved is safe: the other side gains no more on that square than the move took. */
export function movedPieceIsSafe(pos: Position, move: ChessMove): boolean {
  return exchangeGain(makeMove(pos, move), move.to) <= taken(pos, move);
}

/** A capture that leaves the side to move ahead after the whole exchange, or null. */
export function winsMaterial(pos: Position): ChessMove | null {
  for (const m of legalMoves(pos)) {
    const points = taken(pos, m);
    if (points > 0 && points - exchangeGain(makeMove(pos, m), m.to) > 0) return m;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// The three ideas

/** `suggest` is the move the hint shows: one of the accepted ones, the easiest to explain. */
export type CenterRound = { line: string[]; suggest: string };
export type DevelopRound = { line: string[]; suggest: string };
export type CastleRound = { fen: string; suggest: string };

/** White to move: put a pawn on d4 or e4. */
export const CENTER_ROUNDS: CenterRound[] = [
  { line: [], suggest: 'e2e4' },
  { line: ['e2e4', 'e7e5'], suggest: 'd2d4' },
  { line: ['e2e4', 'c7c6'], suggest: 'd2d4' },
];

/** White to move: bring a new knight or bishop out. */
export const DEVELOP_ROUNDS: DevelopRound[] = [
  { line: ['e2e4', 'e7e5'], suggest: 'g1f3' },
  { line: ['e2e4', 'e7e5', 'g1f3', 'b8c6'], suggest: 'f1c4' },
  { line: ['d2d4', 'd7d5'], suggest: 'g1f3' },
];

/** White to move: get the king to safety. */
export const CASTLE_ROUNDS: CastleRound[] = [
  { fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -', suggest: 'e1g1' },
  { fen: 'r3kbnr/pppq1ppp/2npb3/4p3/4P3/2NPB3/PPPQ1PPP/R3KBNR w KQkq -', suggest: 'e1c1' },
  { fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq -', suggest: 'e1g1' },
];

export const roundPosition = (round: { line: string[] }): Position => after(round.line);

export type CenterVerdict = 'good' | 'notCenter' | 'unsafe';

export function centerVerdict(pos: Position, move: ChessMove): CenterVerdict {
  const isPawn = pos.board[move.from]?.[1] === 'P';
  if (!isPawn || !['d4', 'e4'].includes(squareName(move.to))) return 'notCenter';
  return movedPieceIsSafe(pos, move) ? 'good' : 'unsafe';
}

export type DevelopVerdict = 'good' | 'notMinor' | 'again' | 'edge' | 'unsafe';

const MINOR_HOMES = ['b1', 'g1', 'c1', 'f1'];

export function developVerdict(pos: Position, move: ChessMove): DevelopVerdict {
  const type = pos.board[move.from]?.[1];
  if (type !== 'N' && type !== 'B') return 'notMinor';
  if (!MINOR_HOMES.includes(squareName(move.from))) return 'again';
  if (type === 'N' && (colOf(move.to) === 0 || colOf(move.to) === 7)) return 'edge';
  return movedPieceIsSafe(pos, move) ? 'good' : 'unsafe';
}

export const isCastle = (pos: Position, move: ChessMove) =>
  pos.board[move.from]?.[1] === 'K' && Math.abs(colOf(move.to) - colOf(move.from)) === 2;

/** The moves a round accepts (for hints and tests). */
export const goodMoves = (pos: Position, judge: (pos: Position, move: ChessMove) => boolean): ChessMove[] =>
  legalMoves(pos).filter((m) => judge(pos, m));

/** Why a choice that is not the best one is not. */
export type ChoiceFlaw = 'side' | 'queen' | 'twice' | 'hang';

export type ChoiceRound = {
  id: 'first' | 'second' | 'third';
  line: string[];
  /** "e2e4" style, in the order of the buttons. */
  options: { move: string; flaw: ChoiceFlaw | null }[];
};

/** "Which move is best?": one option follows the three ideas, the others break one. */
export const CHOICE_ROUNDS: ChoiceRound[] = [
  {
    id: 'first',
    line: ['e2e4', 'e7e5'],
    options: [
      { move: 'a2a3', flaw: 'side' },
      { move: 'g1f3', flaw: null },
      { move: 'd1h5', flaw: 'queen' },
    ],
  },
  {
    id: 'second',
    line: ['e2e4', 'e7e5', 'g1f3', 'b8c6'],
    options: [
      { move: 'f1c4', flaw: null },
      { move: 'f3g5', flaw: 'twice' },
      { move: 'h2h4', flaw: 'side' },
    ],
  },
  {
    id: 'third',
    line: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'],
    options: [
      { move: 'c4f7', flaw: 'hang' },
      { move: 'a2a4', flaw: 'side' },
      { move: 'e1g1', flaw: null },
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------
// The four-move mate

/** The trap, move by move: White mates on f7 if Black does not look. */
export const TRAP_LINE = ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'];

export const trapFrames = (): Position[] => playLine(START_FEN, TRAP_LINE);

export type SpotRound = { line: string[] };
export type DefendRound = { id: 'h5' | 'f3' | 'again'; line: string[]; suggest: string };

/** Black to look: tap the square that the white queen and bishop both aim at. */
export const SPOT_ROUNDS: SpotRound[] = [
  { line: TRAP_LINE.slice(0, 5) },
  { line: ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1f3'] },
];

export const TRAP_SQUARE = squareOf('f7');

/** Black to move and White threatens mate on f7. */
export const DEFEND_ROUNDS: DefendRound[] = [
  { id: 'h5', line: TRAP_LINE.slice(0, 5), suggest: 'g7g6' },
  { id: 'f3', line: ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1f3'], suggest: 'g8f6' },
  { id: 'again', line: ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g7g6', 'h5f3'], suggest: 'g8f6' },
];

export type DefenceVerdict =
  { kind: 'good' } | { kind: 'mate'; reply: ChessMove } | { kind: 'loses'; reply: ChessMove };

/** A defence is good when White then has neither a mate in one nor a capture that wins material. */
export function defenceVerdict(pos: Position, move: ChessMove): DefenceVerdict {
  const next = makeMove(pos, move);
  const mate = matingMoves(next)[0];
  if (mate) return { kind: 'mate', reply: mate };
  const loss = winsMaterial(next);
  return loss ? { kind: 'loses', reply: loss } : { kind: 'good' };
}

export const isGoodDefence = (pos: Position, move: ChessMove) => defenceVerdict(pos, move).kind === 'good';

export const sameMove = (a: ChessMove, b: ChessMove) => a.from === b.from && a.to === b.to;
