'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import type { AuthResponse, PublicUser } from '@bg/protocol';
import { errorKey } from '@/game-runtime/error-key';
import { apiRequest } from '@/online/api';
import { ensureToken, startNewGuest, useSession } from '@/online/session';

const input = 'rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2';

export function AccountScreen() {
  const t = useTranslations();
  const { token, user, setAuth, setUser, clear } = useSession();
  const [tab, setTab] = useState<'register' | 'login'>('register');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Everyone has an account: a guest one is created on first visit (FR-AUTH-01).
  useEffect(() => {
    if (!token) void ensureToken().catch((err: Error) => setError(err.message));
  }, [token]);

  const submit = async <T,>(
    e: FormEvent<HTMLFormElement>,
    run: (form: FormData) => Promise<{ ok: true; data: T } | { ok: false; code: string }>,
    onOk: (data: T) => void,
  ) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const res = await run(new FormData(e.currentTarget));
    if (res.ok) onOk(res.data);
    else setError(res.code);
  };

  if (!user) return <p className="px-4 py-20 text-center text-[var(--muted)]">{t('online.connecting')}</p>;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{t('account.title')}</h1>
      <p className="text-[var(--muted)]">
        {user.kind === 'guest'
          ? t('account.guestNote')
          : t('account.registeredAs', { email: user.email ?? '' })}
      </p>

      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {t(errorKey(error))}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-green-600">
          {notice}
        </p>
      )}

      <form
        key={user.id}
        className="card flex flex-col gap-3"
        onSubmit={(e) =>
          submit<PublicUser>(
            e,
            (f) => apiRequest('PATCH', '/api/me', { displayName: f.get('displayName') }, token),
            (u) => {
              setUser(u);
              setNotice(t('account.saved'));
            },
          )
        }
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('account.displayName')}
          <input
            name="displayName"
            defaultValue={user.displayName}
            minLength={2}
            maxLength={24}
            required
            className={input}
          />
        </label>
        <button type="submit" className="btn self-start">
          {t('account.save')}
        </button>
      </form>

      {user.kind === 'guest' && (
        <section className="card flex flex-col gap-2" aria-label={t('account.newGuest')}>
          <h2 className="font-medium">{t('account.newGuest')}</h2>
          <p className="text-sm text-[var(--muted)]">{t('account.newGuestNote')}</p>
          <button
            type="button"
            className="btn self-start"
            onClick={async () => {
              setError(null);
              try {
                await startNewGuest();
                setNotice(t('account.newGuestDone'));
              } catch (err) {
                setError(err instanceof Error ? err.message : 'network');
              }
            }}
          >
            {t('account.newGuest')}
          </button>
        </section>
      )}

      {user.kind === 'guest' ? (
        <section className="card flex flex-col gap-4">
          <div className="flex gap-2" role="tablist">
            {(['register', 'login'] as const).map((k) => (
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
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) =>
              submit<AuthResponse>(
                e,
                (f) =>
                  tab === 'register'
                    ? apiRequest(
                        'POST',
                        '/api/auth/register',
                        { email: f.get('email'), password: f.get('password'), displayName: user.displayName },
                        token,
                      )
                    : apiRequest('POST', '/api/auth/login', {
                        email: f.get('email'),
                        password: f.get('password'),
                      }),
                (auth) => {
                  setAuth(auth);
                  setNotice(t('account.saved'));
                },
              )
            }
          >
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
            <button type="submit" className="btn btn-primary self-start">
              {t(`account.${tab}`)}
            </button>
          </form>
        </section>
      ) : (
        <button type="button" className="btn self-start" onClick={() => clear()}>
          {t('account.logout')}
        </button>
      )}
    </div>
  );
}
