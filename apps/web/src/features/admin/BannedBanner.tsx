'use client';

import { useTranslations } from 'next-intl';
import { useBanned } from '@/online/banned';
import { useSession } from '@/online/session';

/** Shown on every page once the server refuses this account as banned (auth.banned). */
export function BannedBanner() {
  const t = useTranslations('admin.banned');
  const banned = useBanned((s) => s.banned);
  if (!banned) return null;
  return (
    <div role="alert" className="banned-banner" data-testid="banned-banner">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <span>{t('text')}</span>
        <button
          type="button"
          className="btn px-3 py-1 text-sm"
          onClick={() => {
            useSession.getState().clear();
            useBanned.getState().setBanned(false);
            window.location.assign('/');
          }}
        >
          {t('signOut')}
        </button>
      </div>
    </div>
  );
}
