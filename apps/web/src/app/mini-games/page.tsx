import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { MiniGamesScreen } from '@/features/learn/MiniGamesScreen';
import { toLocale } from '@/i18n/messages';
import { publicPage } from '@/seo/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('games.chess.learn.mini');
  return publicPage({
    title: t('title'),
    description: t('subtitle'),
    path: '/mini-games',
    locale: toLocale(await getLocale()),
  });
}

export default function MiniGamesPage() {
  return <MiniGamesScreen />;
}
