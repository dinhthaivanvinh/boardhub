import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProfileClient } from './ProfileClient';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('profile');
  return { title: t('title'), robots: { index: false } };
}

export default function ProfilePage() {
  return <ProfileClient />;
}
