import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminClient } from './AdminClient';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: t('title'), robots: { index: false } };
}

export default function AdminPage() {
  return <AdminClient />;
}
