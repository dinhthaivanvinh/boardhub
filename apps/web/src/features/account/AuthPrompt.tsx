'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef } from 'react';
import { useAuthPrompt } from '@/online/auth-prompt';
import { AuthPanel } from './AuthPanel';

/**
 * Asked the first time a screen needs an account (creating a room, the profile, an office session…):
 * sign in, register or play as a guest. Never shown once this browser has a session.
 */
export function AuthPrompt() {
  const t = useTranslations('authPrompt');
  const open = useAuthPrompt((s) => s.open);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-0 text-[var(--fg)] backdrop:bg-black/50"
      data-testid="auth-prompt"
      // Esc or the backdrop: no choice made.
      onClose={() => useAuthPrompt.getState().open && useAuthPrompt.getState().cancel()}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current.close();
      }}
    >
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex items-start justify-between gap-2 border-b border-[var(--border)] px-5 py-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {t('title')}
            </h2>
            <p className="text-sm text-[var(--muted)]">{t('subtitle')}</p>
          </div>
          <button
            type="button"
            className="btn px-2.5 py-1"
            onClick={() => dialog.current?.close()}
            aria-label={t('later')}
          >
            ✕
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{open && <AuthPanel headingLevel={3} />}</div>
      </div>
    </dialog>
  );
}
