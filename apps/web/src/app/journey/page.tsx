import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { JourneyScreen } from '@/features/learn/JourneyScreen';
import { toLocale } from '@/i18n/messages';
import { publicPage } from '@/seo/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('games.chess.learn.journey');
  return publicPage({
    title: t('title'),
    description: t('subtitle'),
    path: '/journey',
    locale: toLocale(await getLocale()),
  });
}

export default function JourneyPage() {
  return <JourneyScreen />;
}
