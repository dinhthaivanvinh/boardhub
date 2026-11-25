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
    <Link href="/profile" className="account-pill">
      <span className="account-face" aria-hidden="true" />
      <span className="max-w-32 truncate">{hydrated && user ? user.displayName : t('account')}</span>
    </Link>
  );
}
