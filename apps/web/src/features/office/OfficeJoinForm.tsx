'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { sessionPath } from '@/office/areas';
import { serverUrl } from '@/online/api';

/** "Have a session code?" on the office page. */
export function OfficeJoinForm() {
  const t = useTranslations('officeSession');
  const router = useRouter();
  const [code, setCode] = useState('');
  const valid = /^[A-Z0-9]{6}$/.test(code);
  return (
    <form
      className="card flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        void fetch(serverUrl() + '/api/office/' + code)
          .then((r) => r.json() as Promise<{ activityId?: string | null }>)
          .catch(() => ({ activityId: null }))
          .then((r) => router.push(sessionPath(r.activityId, code)));
      }}
    >
      <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
        {t('haveCode')}
        <input
          value={code}
          onChange={(e) =>
            setCode(
              e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, 6),
            )
          }
          placeholder={t('codePlaceholder')}
          autoComplete="off"
          className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-lg tracking-[0.3em] uppercase"
        />
      </label>
      <button type="submit" className="btn btn-primary py-2.5" disabled={!valid}>
        {t('join')}
      </button>
    </form>
  );
}
