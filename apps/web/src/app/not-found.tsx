import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <Link href="/" className="btn mt-6">
        {t('back')}
      </Link>
    </div>
  );
}
