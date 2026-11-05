import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CreateClient } from '@/features/office/session/clients';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('officeSession');
  return { title: t('newTitle') };
}

export default async function NewSessionPage() {
  const t = await getTranslations('officeSession');
  return (
    <div className="px-4 py-10">
      <h1 className="mx-auto mb-6 max-w-xl text-3xl font-bold tracking-tight">{t('newTitle')}</h1>
      <CreateClient />
    </div>
  );
}
