'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { errorKey } from '@/game-runtime/error-key';

type Result<T> = { ok: true; data: T } | { ok: false; code: string };

/**
 * Loads data and keeps the error code of the last failed call. The previous data stays on screen while a new
 * load is running, and an answer that arrives after a newer request was made is ignored.
 */
export function useLoad<T>(load: () => Promise<Result<T>>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);
  const reload = useCallback(async () => {
    const turn = ++latest.current;
    setLoading(true);
    const res = await load();
    if (turn !== latest.current) return;
    if (res.ok) setData(res.data);
    setError(res.ok ? null : res.code);
    setLoading(false);
  }, [load]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, setData, error, setError, loading, reload };
}

export function ErrorLine({ code, onRetry }: { code: string | null; onRetry?: () => void }) {
  const t = useTranslations();
  if (!code) return null;
  return (
    <div role="alert" className="admin-alert">
      <span>{t(errorKey(code))}</span>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          {t('admin.retry')}
        </button>
      )}
    </div>
  );
}

export function Loading() {
  const t = useTranslations('admin');
  return (
    <p className="admin-empty" role="status">
      {t('loading')}
    </p>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="admin-page-head">
      <h1>{title}</h1>
      {children}
    </div>
  );
}

export function Panel({
  title,
  hint,
  actions,
  children,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card admin-panel" aria-label={title}>
      <div className="admin-panel-head">
        <div>
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
