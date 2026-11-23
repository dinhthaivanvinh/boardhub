import type { Color, PieceType } from '../rules/types';

/** Lesson data only: no rules live here, moves and targets come from the engine. Text is in i18n (`games.chess.learn.*`). */
export type PieceLessonData = {
  id: 'pawn' | 'rook' | 'bishop' | 'knight' | 'queen' | 'king';
  piece: PieceType;
  /** A position with White to move and one piece to look at. Both kings are always present. */
  fen: string;
  /** The piece's square. */
  from: string;
  challenge: { fen: string; from: string; goal: string };
};

export type OpeningLessonData = {
  id: 'italian' | 'queens-gambit' | 'london' | 'ruy-lopez' | 'sicilian' | 'french';
  /** The side the child plays. */
  side: Color;
  /** Whole line from the start position, "e2e4" style. Ply `i` has the text `s<i>`. */
  moves: string[];
};

export const PIECE_LESSONS: PieceLessonData[] = [
  {
    id: 'pawn',
    piece: 'P',
    fen: '4k3/8/8/8/8/8/4P3/7K w - -',
    from: 'e2',
    challenge: { fen: '4k3/8/8/3p4/4P3/8/8/7K w - -', from: 'e4', goal: 'd5' },
  },
  {
    id: 'rook',
    piece: 'R',
    fen: 'k7/8/8/8/3R4/8/8/7K w - -',
    from: 'd4',
    challenge: { fen: '7k/8/8/8/3R3p/8/8/K7 w - -', from: 'd4', goal: 'h4' },
  },
  {
    id: 'bishop',
    piece: 'B',
    fen: 'k7/8/8/8/3B4/8/8/7K w - -',
    from: 'd4',
    challenge: { fen: 'k7/6p1/8/8/3B4/8/8/7K w - -', from: 'd4', goal: 'g7' },
  },
  {
    id: 'knight',
    piece: 'N',
    fen: 'k7/8/8/8/3N4/8/8/7K w - -',
    from: 'd4',
    challenge: { fen: 'k7/8/8/1p6/3N4/8/8/7K w - -', from: 'd4', goal: 'b5' },
  },
  {
    id: 'queen',
    piece: 'Q',
    fen: 'k7/8/8/8/3Q4/8/8/7K w - -',
    from: 'd4',
    challenge: { fen: 'k7/3p4/8/8/3Q4/8/8/7K w - -', from: 'd4', goal: 'd7' },
  },
  {
    id: 'king',
    piece: 'K',
    fen: 'k7/8/8/8/3K4/8/8/8 w - -',
    from: 'd4',
    challenge: { fen: 'k7/8/8/4p3/3K4/8/8/8 w - -', from: 'd4', goal: 'e5' },
  },
];

export const OPENING_LESSONS: OpeningLessonData[] = [
  {
    id: 'italian',
    side: 'w',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d4', 'e5d4', 'c3d4'],
  },
  {
    id: 'queens-gambit',
    side: 'w',
    moves: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5', 'f8e7', 'e2e3', 'e8g8', 'g1f3'],
  },
  {
    id: 'sicilian',
    side: 'b',
    moves: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'],
  },
  {
    id: 'london',
    side: 'w',
    moves: ['d2d4', 'd7d5', 'c1f4', 'g8f6', 'e2e3', 'e7e6', 'g1f3', 'c7c5', 'c2c3', 'b8c6'],
  },
  {
    id: 'ruy-lopez',
    side: 'w',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7'],
  },
  {
    id: 'french',
    side: 'b',
    moves: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6', 'c1g5', 'f8e7', 'e4e5', 'f6d7'],
  },
];

/** Special moves: a demo played from `fen`, then the child plays `challenge` themselves. */
export type SpecialLessonData = {
  id: 'castling' | 'en-passant' | 'promotion';
  fen: string;
  /** Plies of the demo, "e1g1" style (a fifth letter is the promotion piece). */
  demo: string[];
  challenge: { fen: string; from: string; to: string };
};

export const SPECIAL_LESSONS: SpecialLessonData[] = [
  {
    id: 'castling',
    fen: '4k3/8/8/8/8/8/8/R3K2R w KQ -',
    demo: ['e1g1'],
    challenge: { fen: '4k3/8/8/8/8/8/8/R3K2R w KQ -', from: 'e1', to: 'c1' },
  },
  {
    id: 'en-passant',
    fen: '4k3/3p4/8/4P3/8/8/8/4K3 b - -',
    demo: ['d7d5', 'e5d6'],
    challenge: { fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6', from: 'e5', to: 'd6' },
  },
  {
    id: 'promotion',
    fen: '8/P6k/8/8/8/8/8/7K w - -',
    demo: ['a7a8q'],
    challenge: { fen: '8/4P2k/8/8/8/8/8/7K w - -', from: 'e7', to: 'e8' },
  },
];

export const LESSON_IDS = [
  ...PIECE_LESSONS.map((l) => l.id),
  ...OPENING_LESSONS.map((l) => l.id),
  ...SPECIAL_LESSONS.map((l) => l.id),
] as const;
export type LessonId = (typeof LESSON_IDS)[number];

export const pieceLesson = (id: string) => PIECE_LESSONS.find((l) => l.id === id);
export const openingLesson = (id: string) => OPENING_LESSONS.find((l) => l.id === id);
export const specialLesson = (id: string) => SPECIAL_LESSONS.find((l) => l.id === id);
