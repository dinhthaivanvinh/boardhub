'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';
import type { AuthResponse } from '@bg/protocol';
import { ParentNote } from '@/features/legal/ParentNote';
import { errorKey } from '@/game-runtime/error-key';
import { apiRequest } from '@/online/api';
import { createGuest, rememberGuestChoice, useSession } from '@/online/session';

const input = 'rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2';

/**
 * Sign in, register, or play as a guest (FR-AUTH-01/02). Used by the account page and by the dialog
 * that opens the first time a screen needs an account. A guest can register later and keep everything.
 */
export function AuthPanel({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const t = useTranslations();
  const setAuth = useSession((s) => s.setAuth);
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(false);
  const ids = useId();
  const H = headingLevel === 2 ? 'h2' : 'h3';

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const res =
      tab === 'register'
        ? await apiRequest<AuthResponse>('POST', '/api/auth/register', {
            email: f.get('email'),
            password: f.get('password'),
            displayName: f.get('displayName'),
          })
        : await apiRequest<AuthResponse>('POST', '/api/auth/login', {
            email: f.get('email'),
            password: f.get('password'),
          });
    setBusy(false);
    if (res.ok) setAuth(res.data);
    else setError(res.code);
  };

  const guest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get('guestName') ?? '').trim();
    setBusy(true);
    setError(null);
    try {
      rememberGuestChoice(remember);
      await createGuest(name.length >= 2 ? name : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5" data-testid="auth-panel">
      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {t(errorKey(error))}
        </p>
      )}

      <section className="flex flex-col gap-3" aria-labelledby={`${ids}-account`}>
        <H id={`${ids}-account`} className="font-semibold">
          {t('authPrompt.withAccount')}
        </H>
        <div className="flex gap-2" role="tablist">
          {(['login', 'register'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={`btn ${tab === k ? 'btn-primary' : ''}`}
              onClick={() => setTab(k)}
            >
              {t(`account.${k}`)}
            </button>
          ))}
        </div>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          {tab === 'register' && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('account.displayName')}
              <input name="displayName" minLength={2} maxLength={24} required className={input} />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('account.email')}
            <input name="email" type="email" autoComplete="email" required className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('account.password')}
            <input
              name="password"
              type="password"
              autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
              minLength={tab === 'register' ? 8 : 1}
              required
              className={input}
            />
          </label>
          {tab === 'register' && <ParentNote />}
          <button
            type="submit"
            className="btn btn-primary self-start"
            disabled={busy}
            data-testid="auth-submit"
          >
            {t(`account.${tab}`)}
          </button>
        </form>
      </section>

      <div className="auth-divider" aria-hidden="true">
        <span>{t('authPrompt.or')}</span>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby={`${ids}-guest`}>
        <H id={`${ids}-guest`} className="font-semibold">
          {t('authPrompt.asGuest')}
        </H>
        <p className="text-sm text-[var(--muted)]">{t('authPrompt.guestNote')}</p>
        <form className="flex flex-col gap-3" onSubmit={guest}>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('authPrompt.guestName')}
            <input
              name="guestName"
              maxLength={24}
              placeholder={t('authPrompt.guestNamePlaceholder')}
              className={input}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent)]"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            {t('authPrompt.remember')}
          </label>
          <button type="submit" className="btn self-start" disabled={busy} data-testid="auth-guest">
            {t('authPrompt.playAsGuest')}
          </button>
        </form>
      </section>
    </div>
  );
}
