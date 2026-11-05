'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { OfficeSnapshot } from '@bg/protocol';
import { errorKey } from '@/game-runtime/error-key';
import { getOfficeSocket, officeRequest } from '@/office/office-socket';

const SUGGESTIONS = ['tea', 'present', 'duty', 'icebreaker'] as const;

/** Start a session: pick the question, get a code, land on the host console. */
export function CreateSessionForm() {
  const t = useTranslations('officeSession');
  const tAll = useTranslations();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="card mx-auto flex max-w-xl flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const s = await getOfficeSocket();
        const res = await officeRequest<{ session: OfficeSnapshot }>(s, 'office:create', {
          activityId: 'lucky-animal',
          title: title.trim(),
          settings: {},
        });
        setBusy(false);
        if (!res.ok) return setError(res.code);
        router.push(`/office/s/${res.data.session.code}/host`);
      }}
    >
      <label className="flex flex-col gap-1 font-medium">
        {t('titleLabel')}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          placeholder={t('suggestions.tea')}
          className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-lg"
        />
      </label>
      <div className="flex flex-wrap gap-2" aria-label={t('suggestionsLabel')}>
        {SUGGESTIONS.map((key) => (
          <button key={key} type="button" className="chip" onClick={() => setTitle(t(`suggestions.${key}`))}>
            {t(`suggestions.${key}`)}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {tAll(errorKey(error))}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
        {t('create')}
      </button>
    </form>
  );
}
