import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { AvatarStudio } from '@/features/office/avatar-studio/AvatarStudio';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('avatar');
  return { title: t('title'), robots: { index: false } };
}

export default function MyAnimalPage() {
  // The studio reads the address (`?back=`), so the page needs a Suspense boundary to be built ahead of time.
  return (
    <Suspense>
      <AvatarStudio />
    </Suspense>
  );
}
