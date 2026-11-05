import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LiveClient } from './LiveClient';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('live');
  return { title: t('title') };
}

export default function LivePage() {
  return <LiveClient />;
}
