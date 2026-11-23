import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { LearnHome } from '@/features/learn/LearnHome';
import { toLocale } from '@/i18n/messages';
import { publicPage } from '@/seo/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return publicPage({
    title: t('games.chess.learn.title'),
    description: t('games.chess.learn.subtitle'),
    path: '/learn/chess',
    locale: toLocale(await getLocale()),
  });
}

export default function LearnChessPage() {
  return <LearnHome />;
}
