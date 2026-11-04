'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

export function InviteBox({ code }: { code: string }) {
  const t = useTranslations('room');
  const [copied, setCopied] = useState(false);
  const link = typeof window === 'undefined' ? `/room/${code}` : `${window.location.origin}/room/${code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard needs a secure context (not available on plain http over LAN): select the text instead.
      (document.getElementById('invite-link') as HTMLInputElement | null)?.select();
    }
  };

  return (
    <div className="card flex flex-col gap-3">
      <p className="text-sm text-[var(--muted)]">{t('code')}</p>
      <p className="font-mono text-3xl font-bold tracking-[0.3em]" data-testid="room-code">
        {code}
      </p>
      <label className="text-sm" htmlFor="invite-link">
        {t('invite')}
      </label>
      <div className="flex gap-2">
        <input
          id="invite-link"
          readOnly
          value={link}
          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className="btn" onClick={copy}>
          {copied ? t('copied') : t('copy')}
        </button>
      </div>
    </div>
  );
}
