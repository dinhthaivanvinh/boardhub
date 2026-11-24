import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { PuzzleScreen } from '@/features/learn/PuzzleScreen';
import { toLocale } from '@/i18n/messages';
import { publicPage } from '@/seo/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('games.chess.learn.puzzles');
  return publicPage({
    title: t('title'),
    description: t('subtitle'),
    path: '/puzzles',
    locale: toLocale(await getLocale()),
  });
}

export default function PuzzlesPage() {
  return <PuzzleScreen />;
}
