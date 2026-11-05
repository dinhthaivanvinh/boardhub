import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('office');
  return { title: t('myAnimal') };
}

/** Placeholder until the avatar studio lands (docs/office/08-roadmap.md, O1). */
export default async function MyAnimalPage() {
  const t = await getTranslations('office');
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-20 text-center">
      <span className="text-6xl" aria-hidden="true">
        🐾
      </span>
      <h1 className="text-3xl font-bold tracking-tight">{t('myAnimal')}</h1>
      <p className="text-[var(--muted)]">{t('avatarSoon')}</p>
      <Link href="/office" className="btn">
        ← {t('title')}
      </Link>
    </div>
  );
}
