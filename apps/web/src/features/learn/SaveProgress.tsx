'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useHydrated } from '@/features/account/use-hydrated';
import { useAuthPrompt } from '@/online/auth-prompt';
import { useSession } from '@/online/session';

/**
 * Asks to keep the journey on an account, so it follows the child to another device and survives clearing
 * the browser. Learning never needs an account: this only offers one. `compact` is the short form for the
 * home page, shown only while the journey is not yet saved on a full account.
 */
export function SaveProgress({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('games.chess.learn.journey.save');
  const hydrated = useHydrated();
  const user = useSession((s) => s.user);
  const token = useSession((s) => s.token);
  if (!hydrated) return null;

  const registered = Boolean(token && user?.kind === 'registered');
  if (registered && compact) return null;

  const body = registered ? t('saved', { name: user?.displayName ?? '' }) : token ? t('guest') : t('ask');

  return (
    <aside
      className="save-progress"
      data-state={registered ? 'saved' : token ? 'guest' : 'none'}
      data-testid="save-progress"
    >
      <span className="save-progress-icon" aria-hidden="true">
        {registered ? '✅' : '💾'}
      </span>
      <div className="save-progress-body">
        <p className="font-bold">{registered ? t('titleSaved') : t('title')}</p>
        <p className="text-sm text-[var(--muted)]">{body}</p>
        {!registered && <p className="text-sm text-[var(--muted)]">{t('parent')}</p>}
      </div>
      {!registered &&
        (token ? (
          <Link href="/account" className="btn btn-primary" data-testid="save-progress-register">
            {t('register')}
          </Link>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            data-testid="save-progress-button"
            onClick={() =>
              void useAuthPrompt
                .getState()
                .ask()
                .catch(() => undefined)
            }
          >
            {t('button')}
          </button>
        ))}
    </aside>
  );
}
