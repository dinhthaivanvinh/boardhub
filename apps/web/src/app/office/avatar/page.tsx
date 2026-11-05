import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AvatarStudio } from '@/features/office/avatar-studio/AvatarStudio';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('avatar');
  return { title: t('title') };
}

export default function MyAnimalPage() {
  return <AvatarStudio />;
}
