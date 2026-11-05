import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { toLocale } from '@/i18n/messages';
import { publicPage } from '@/seo/site';
import { LiveScreen } from '@/features/competitive/LiveScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('live');
  return publicPage({
    title: t('title'),
    description: t('subtitle'),
    path: '/live',
    locale: toLocale(await getLocale()),
  });
}

export default function LivePage() {
  // Rendered on the server too (heading and text); the list of games loads in the browser.
  return <LiveScreen />;
}
