import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  CHECKMATE_LESSON_ID,
  COORDINATES_LESSON_ID,
  LESSON_IDS,
  openingLesson,
  pieceLesson,
  specialLesson,
} from '@bg/game-chess';
import { LessonScreen } from '@/features/learn/LessonScreen';
import { toLocale } from '@/i18n/messages';
import { publicPage } from '@/seo/site';

type Props = { params: Promise<{ lessonId: string }> };

const isLesson = (id: string) => (LESSON_IDS as readonly string[]).includes(id);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lessonId } = await params;
  if (!isLesson(lessonId)) return {};
  const t = await getTranslations();
  const piece = pieceLesson(lessonId);
  const title =
    lessonId === COORDINATES_LESSON_ID
      ? t('games.chess.learn.coordinates.name')
      : lessonId === CHECKMATE_LESSON_ID
        ? t('games.chess.learn.checkmate.name')
        : piece
          ? t(`games.chess.pieceNames.${piece.piece}`)
          : specialLesson(lessonId)
            ? t(`games.chess.learn.specials.${lessonId}.name`)
            : t(`games.chess.learn.openings.${openingLesson(lessonId)!.id}.name`);
  return publicPage({
    title: `${title} · ${t('games.chess.learn.title')}`,
    description: t('games.chess.learn.subtitle'),
    path: `/learn/chess/${lessonId}`,
    locale: toLocale(await getLocale()),
  });
}

export default async function LessonPage({ params }: Props) {
  const { lessonId } = await params;
  if (!isLesson(lessonId)) notFound();
  return <LessonScreen lessonId={lessonId} />;
}
