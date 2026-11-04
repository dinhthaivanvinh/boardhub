'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSession } from '@/online/session';
import { useHydrated } from './use-hydrated';

export function AccountLink() {
  const t = useTranslations('nav');
  const hydrated = useHydrated();
  const user = useSession((s) => s.user);
  return (
    <Link href="/profile" className="max-w-40 truncate text-sm underline-offset-4 hover:underline">
      {hydrated && user ? user.displayName : t('account')}
    </Link>
  );
}
