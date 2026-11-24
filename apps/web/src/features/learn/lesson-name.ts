import type { useTranslations } from 'next-intl';
import { openingLesson, pieceLesson, specialLesson } from '@bg/game-chess';

/** The display name of a lesson, whatever its kind. */
export function lessonName(id: string, t: ReturnType<typeof useTranslations>): string {
  const piece = pieceLesson(id);
  if (piece) return t(`games.chess.pieceNames.${piece.piece}`);
  if (openingLesson(id)) return t(`games.chess.learn.openings.${id}.name`);
  if (specialLesson(id)) return t(`games.chess.learn.specials.${id}.name`);
  return t(`games.chess.learn.${id}.name`);
}
