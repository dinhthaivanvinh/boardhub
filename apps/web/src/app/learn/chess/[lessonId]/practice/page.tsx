import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { PRACTICE_LESSON_IDS } from '@bg/game-chess';
import { PracticeScreen } from '@/features/learn/PracticeScreen';
import { toLocale } from '@/i18n/messages';
import { publicPage } from '@/seo/site';

type Props = { params: Promise<{ lessonId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lessonId } = await params;
  if (!PRACTICE_LESSON_IDS.includes(lessonId)) return {};
  const t = await getTranslations('games.chess.learn');
  return publicPage({
    title: t('practice.stage.practice'),
    description: t('subtitle'),
    path: `/learn/chess/${lessonId}/practice`,
    locale: toLocale(await getLocale()),
  });
}

export default async function PracticePage({ params }: Props) {
  const { lessonId } = await params;
  if (!PRACTICE_LESSON_IDS.includes(lessonId)) notFound();
  return <PracticeScreen lessonId={lessonId} />;
}
