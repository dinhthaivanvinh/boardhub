import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LiXiCreateClient } from '@/features/party/clients';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('liXiNew');
  return { title: t('title'), robots: { index: false } };
}

export default async function NewLiXiPage() {
  const t = await getTranslations('liXiNew');
  return (
    <div className="px-4 py-10">
      <h1 className="mx-auto mb-6 max-w-2xl text-3xl font-bold tracking-tight">🧧 {t('title')}</h1>
      <LiXiCreateClient />
    </div>
  );
}
