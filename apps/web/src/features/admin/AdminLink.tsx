'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useHydrated } from '@/features/account/use-hydrated';
import { useSession } from '@/online/session';

/** Header link to /admin, only for admins (ADMIN_EMAILS on the server). */
export function AdminLink() {
  const t = useTranslations('nav');
  const hydrated = useHydrated();
  const admin = useSession((s) => s.user?.admin === true);
  if (!hydrated || !admin) return null;
  return (
    <Link href="/admin" className="nav-link text-sm" data-testid="admin-link">
      {t('admin')}
    </Link>
  );
}
