import { fromFen } from '../rules/board';
import type { Position } from '../rules/types';
import { CAPTURE_LESSON_ID } from './capture';
import {
  openingLesson,
  pieceLesson,
  SPECIAL_LESSONS,
  specialLesson,
  OPENING_LESSONS,
  PIECE_LESSONS,
} from './data';
import { positionsOf } from './logic';
import { PIECE_PRACTICE } from './practice-data';

/** What a "move" round asks for; the text is `games.chess.learn.practice.prompt.<key>`. */
export type PracticePrompt =
  | { key: 'capture'; piece: 'P' | 'R' | 'B' | 'N' | 'Q' | 'K' }
  | { key: 'opening' }
  | { key: 'castling' | 'enPassant' | 'promotion'; to: string };

/** Which piece can go to the star? (tap it) */
export type StarRound = { kind: 'star'; fen: string; star: string; answer: string };
/** Play this move (the side to move is the child). A promotion becomes a queen. */
export type MoveRound = {
  kind: 'move';
  /** A position, or a ply of an opening line (the line's own moves are the answer). */
  source: { fen: string } | { opening: string; ply: number };
  from: string;
  to: string;
  prompt: PracticePrompt;
};
export type PracticeRound = StarRound | MoveRound;

/** A finished practice is remembered next to the lessons, under this id. */
export const practiceId = (lessonId: string) => `practice-${lessonId}`;

export const STARS_PER_PRACTICE = 2;
const ROUNDS = 5;

/** Castling, en passant and promotion, each from five different positions. White to move. */
const SPECIAL_PRACTICE: Record<string, { fen: string; from: string; to: string }[]> = {
  castling: [
    { fen: '4k3/8/8/8/8/8/8/R3K2R w KQ -', from: 'e1', to: 'g1' },
    { fen: '4k3/8/8/8/8/8/8/R3K2R w KQ -', from: 'e1', to: 'c1' },
    { fen: 'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq -', from: 'e1', to: 'g1' },
    { fen: 'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq -', from: 'e1', to: 'c1' },
    { fen: 'r3k2r/8/8/8/8/8/PPPPPPPP/R3K2R w KQkq -', from: 'e1', to: 'g1' },
  ],
  'en-passant': [
    { fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6', from: 'e5', to: 'd6' },
    { fen: '4k3/8/8/4Pp2/8/8/8/4K3 w - f6', from: 'e5', to: 'f6' },
    { fen: '4k3/8/8/pP6/8/8/8/4K3 w - a6', from: 'b5', to: 'a6' },
    { fen: '4k3/8/8/6pP/8/8/8/4K3 w - g6', from: 'h5', to: 'g6' },
    { fen: '4k3/8/8/2pP4/8/8/8/4K3 w - c6', from: 'd5', to: 'c6' },
  ],
  promotion: [
    { fen: '8/4P2k/8/8/8/8/8/7K w - -', from: 'e7', to: 'e8' },
    { fen: '8/P6k/8/8/8/8/8/7K w - -', from: 'a7', to: 'a8' },
    { fen: '6k1/1P6/8/8/8/8/8/K7 w - -', from: 'b7', to: 'b8' },
    { fen: '1r2k3/P7/8/8/8/8/8/4K3 w - -', from: 'a7', to: 'b8' },
    { fen: '8/2P4k/8/8/8/8/8/K7 w - -', from: 'c7', to: 'c8' },
  ],
};

const SPECIAL_PROMPT = { castling: 'castling', 'en-passant': 'enPassant', promotion: 'promotion' } as const;

/** The practice of a lesson: five short rounds on what the lesson taught, or null when it has none. */
export function practiceRounds(lessonId: string): PracticeRound[] | null {
  const piece = pieceLesson(lessonId);
  if (piece) {
    const bank = PIECE_PRACTICE[piece.piece];
    const star = (i: number): PracticeRound => ({ kind: 'star', ...bank.star[i]! });
    const capture = (i: number): PracticeRound => ({
      kind: 'move',
      source: { fen: bank.capture[i]!.fen },
      from: bank.capture[i]!.from,
      to: bank.capture[i]!.to,
      prompt: { key: 'capture', piece: piece.piece },
    });
    return [star(0), capture(0), star(1), capture(1), star(2)];
  }

  if (lessonId === CAPTURE_LESSON_ID) {
    return (['P', 'R', 'B', 'N', 'Q'] as const).map((type) => {
      const c = PIECE_PRACTICE[type].capture[0]!;
      return {
        kind: 'move',
        source: { fen: c.fen },
        from: c.from,
        to: c.to,
        prompt: { key: 'capture', piece: type },
      };
    });
  }

  const opening = openingLesson(lessonId);
  if (opening) {
    const positions = positionsOf(opening);
    const plies = opening.moves.map((_, i) => i).filter((i) => positions[i]!.turn === opening.side);
    return plies.slice(0, 6).map((ply) => {
      const move = opening.moves[ply]!;
      return {
        kind: 'move',
        source: { opening: opening.id, ply },
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        prompt: { key: 'opening' },
      };
    });
  }

  const special = specialLesson(lessonId);
  if (special) {
    return SPECIAL_PRACTICE[special.id]!.slice(0, ROUNDS).map((r) => ({
      kind: 'move',
      source: { fen: r.fen },
      from: r.from,
      to: r.to,
      prompt: { key: SPECIAL_PROMPT[special.id], to: r.to },
    }));
  }
  return null;
}

/** Lessons that have a practice, in the order of the journey. */
export const PRACTICE_LESSON_IDS: readonly string[] = [
  ...PIECE_LESSONS.map((l) => l.id),
  CAPTURE_LESSON_ID,
  ...OPENING_LESSONS.map((l) => l.id),
  ...SPECIAL_LESSONS.map((l) => l.id),
];

/** The position of a round, and the moves that led to it when it is a ply of an opening line. */
export function practicePosition(round: PracticeRound): Position {
  if (round.kind === 'star' || 'fen' in round.source) {
    return fromFen('fen' in round ? round.fen : (round.source as { fen: string }).fen);
  }
  const opening = openingLesson(round.source.opening)!;
  return positionsOf(opening)[round.source.ply]!;
}
