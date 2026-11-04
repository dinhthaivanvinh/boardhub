import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AccountClient } from './AccountClient';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account');
  return { title: t('title'), robots: { index: false } };
}

export default function AccountPage() {
  return <AccountClient />;
}
