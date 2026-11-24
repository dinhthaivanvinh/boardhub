import { fromFen, inCheck, insufficientMaterial, legalMoves, squareOf, START_FEN } from '../rules/board';
import type { Color, PieceType } from '../rules/types';

/** The lesson on how a game begins: the pieces on their squares, who moves first, what the game is for. */
export const SETUP_LESSON_ID = 'setup';
/** The lesson on the ways a game can end without a winner. */
export const DRAWS_LESSON_ID = 'draws';

/** The start position every game of chess begins from. */
export { START_FEN };

/** "Which piece stands here?": the start position without the piece on `square`. */
export type PlaceRound = { square: string; color: Color; piece: PieceType };

export const PLACE_ROUNDS: PlaceRound[] = [
  { square: 'd1', color: 'w', piece: 'Q' },
  { square: 'e1', color: 'w', piece: 'K' },
  { square: 'g1', color: 'w', piece: 'N' },
  { square: 'c1', color: 'w', piece: 'B' },
  { square: 'h8', color: 'b', piece: 'R' },
  { square: 'd8', color: 'b', piece: 'Q' },
];

/** The six kinds of piece, in the order the buttons show them. */
export const PLACE_OPTIONS: PieceType[] = ['K', 'Q', 'R', 'B', 'N', 'P'];

/**
 * A question with a few answers to choose from. The texts are in i18n under `<lesson>.quiz.<id>`: `q` (the
 * question), `o0`, `o1`, ... (the answers) and `right` / `wrong`. `answer` is the index of the right one.
 */
export type QuizRound = {
  id: string;
  options: number;
  answer: number;
  /** Squares of the start position to light up while asking. */
  marks?: string[];
};

export const SETUP_QUIZ: QuizRound[] = [
  { id: 'first', options: 2, answer: 0 },
  { id: 'corner', options: 2, answer: 0, marks: ['h1'] },
  { id: 'queenColor', options: 2, answer: 1, marks: ['d8'] },
  { id: 'turns', options: 2, answer: 1 },
  { id: 'goal', options: 3, answer: 2 },
];

/** Whether a board square is light: a1 is dark, h1 is light. */
export const isLightSquare = (square: string) => {
  const s = squareOf(square);
  return (Math.floor(s / 8) + (s % 8)) % 2 === 0;
};

export type Outcome = 'win' | 'draw' | 'ongoing';
export const OUTCOMES: Outcome[] = ['win', 'draw', 'ongoing'];

/** A finished or unfinished position and what it is. `side` is the side to move. `outcome` is checked by a test. */
export type JudgeRound = { id: string; fen: string; outcome: Outcome };

export const JUDGE_ROUNDS: JudgeRound[] = [
  { id: 'stalemate', fen: '7k/5Q2/6K1/8/8/8/8/8 b - -', outcome: 'draw' },
  { id: 'mate', fen: 'R5k1/5ppp/8/8/8/8/8/6K1 b - -', outcome: 'win' },
  { id: 'kingsOnly', fen: '8/8/4k3/8/8/4K3/8/8 w - -', outcome: 'draw' },
  { id: 'rook', fen: '8/8/4k3/8/8/4K3/8/7R b - -', outcome: 'ongoing' },
  { id: 'bishop', fen: '8/8/4k3/8/8/4K3/8/5B2 b - -', outcome: 'draw' },
  { id: 'queen', fen: '8/8/4k3/8/8/4K3/8/7Q b - -', outcome: 'ongoing' },
];

/** What the engine says about a position: mate, a draw (no moves but no check, or too few pieces), or play on. */
export function outcomeOf(fen: string): Outcome {
  const pos = fromFen(fen);
  const stuck = legalMoves(pos).length === 0;
  if (stuck && inCheck(pos.board, pos.turn)) return 'win';
  if (stuck || insufficientMaterial(pos.board)) return 'draw';
  return 'ongoing';
}

/** Draws that no single position can show: a thing that happens over many moves. */
export const DRAW_QUIZ: QuizRound[] = [
  { id: 'repeat', options: 2, answer: 0 },
  { id: 'fifty', options: 2, answer: 0 },
  { id: 'chase', options: 2, answer: 1 },
];
