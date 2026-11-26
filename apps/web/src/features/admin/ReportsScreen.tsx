'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import {
  SANCTION_FOREVER,
  SANCTION_HOURS,
  type AdminReport,
  type ReportAction,
  type SanctionedUser,
  type UserSanctions,
} from '@bg/protocol';
import { adminReports, adminSanctioned, resolveReport, setSanctions } from '@/online/admin-api';
import { useRefreshReportCount } from './AdminShell';
import { ErrorLine, Loading, PageHeader, useLoad } from './ui/common';

type Tab = 'open' | 'resolved' | 'sanctions';
const TABS: Tab[] = ['open', 'resolved', 'sanctions'];

/** /admin/reports (M4b): player reports and current sanctions. The server checks every action. */
export function ReportsScreen() {
  const t = useTranslations('admin');
  const [tab, setTab] = useState<Tab>('open');
  return (
    <>
      <PageHeader title={t('nav.reports')} />
      <div className="admin-segment" role="tablist" aria-label={t('nav.reports')}>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            data-testid={`admin-tab-${id}`}
          >
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab === 'sanctions' ? <Sanctions /> : <Reports key={tab} status={tab} />}</div>
    </>
  );
}

function useUntil() {
  const t = useTranslations('admin');
  const format = useFormatter();
  return (until: number | null) =>
    until === null
      ? null
      : until >= SANCTION_FOREVER
        ? t('forever')
        : t('until', { at: format.dateTime(until, { dateStyle: 'short', timeStyle: 'short' }) });
}

function SanctionChips({ s }: { s: UserSanctions }) {
  const t = useTranslations('admin');
  const until = useUntil();
  return (
    <>
      {s.mutedUntil !== null && (
        <span className="chip">
          {t('muted')} · {until(s.mutedUntil)}
        </span>
      )}
      {s.bannedUntil !== null && (
        <span className="chip chip-danger">
          {t('bannedChip')} · {until(s.bannedUntil)}
        </span>
      )}
    </>
  );
}

// ---------------------------------------------------------------- reports

function Reports({ status }: { status: 'open' | 'resolved' }) {
  const t = useTranslations('admin');
  const load = useCallback(() => adminReports(status), [status]);
  const { data, error, setError, reload } = useLoad(load);
  const refreshCount = useRefreshReportCount();

  if (!data) return error ? <ErrorLine code={error} onRetry={() => void reload()} /> : <Loading />;
  return (
    <div className="flex flex-col gap-4">
      <ErrorLine code={error} />
      {data.reports.length === 0 && <p className="admin-empty">{t(`empty.${status}`)}</p>}
      {data.reports.map((r) => (
        <ReportCard
          key={r.id}
          report={r}
          onDone={async (code) => {
            await reload();
            setError(code);
            refreshCount();
          }}
        />
      ))}
    </div>
  );
}

function ReportCard({
  report: r,
  onDone,
}: {
  report: AdminReport;
  onDone(code: string | null): Promise<void>;
}) {
  const t = useTranslations('admin');
  const tr = useTranslations('report');
  const format = useFormatter();
  const [hours, setHours] = useState<number | null>(24);
  const [busy, setBusy] = useState(false);
  const [confirmBan, setConfirmBan] = useState(false);

  const act = async (action: ReportAction) => {
    setBusy(true);
    const res = await resolveReport(r.id, { action, hours });
    setBusy(false);
    await onDone(res.ok ? null : res.code);
  };

  return (
    <article className="card flex flex-col gap-3" data-testid="admin-report">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{r.target.name}</h2>
        {r.target.kind === 'guest' && <span className="chip">{t('guest')}</span>}
        <span className="chip chip-accent">{tr(`reasons.${r.reason}`)}</span>
        <SanctionChips s={r.sanctions} />
        <span className="ml-auto text-sm text-[var(--muted)]">
          {format.dateTime(r.createdAt, { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      </header>
      <p className="text-sm text-[var(--muted)]">
        {t('reportedBy', { name: r.reporter.name })}
        {r.roomCode && <> · {t('room', { code: r.roomCode })}</>}
        {r.status === 'open' && r.openAgainstTarget > 1 && (
          <>
            {' '}
            · <strong>{t('openAgainst', { n: r.openAgainstTarget })}</strong>
          </>
        )}
      </p>
      {r.note && <blockquote className="admin-note">{r.note}</blockquote>}
      {r.evidence.length > 0 && (
        <section aria-label={t('evidence')}>
          <h3 className="mb-1 text-sm font-medium">{t('evidence')}</h3>
          <ol className="admin-evidence" data-testid="admin-evidence">
            {r.evidence.map((line, i) => (
              <li key={i}>
                <time className="text-[var(--muted)]">
                  {format.dateTime(line.at, { timeStyle: 'short' })}
                </time>{' '}
                {line.text}
              </li>
            ))}
          </ol>
        </section>
      )}

      {r.status === 'resolved' ? (
        <p className="text-sm" data-testid="admin-outcome">
          {t('outcome', { action: t(`actions.${r.action ?? 'dismiss'}`) })}
          {r.resolvedAt !== null && (
            <span className="text-[var(--muted)]">
              {' '}
              · {format.dateTime(r.resolvedAt, { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          )}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            {t('duration')}
            <select
              className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1"
              value={hours === null ? 'forever' : String(hours)}
              onChange={(e) => setHours(e.target.value === 'forever' ? null : Number(e.target.value))}
              data-testid="admin-duration"
            >
              {SANCTION_HOURS.map((h) => (
                <option key={h ?? 'forever'} value={h === null ? 'forever' : String(h)}>
                  {h === null ? t('forever') : t('hours', { h })}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn" disabled={busy} onClick={() => act('dismiss')}>
            {t('actions.dismiss')}
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => act('mute')}
            data-testid="admin-mute"
          >
            {t('actions.mute')}
          </button>
          {confirmBan ? (
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={() => act('ban')}
              data-testid="admin-ban-confirm"
            >
              {t('confirmBan')}
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => setConfirmBan(true)}
              data-testid="admin-ban"
            >
              {t('actions.ban')}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------- sanctions

function Sanctions() {
  const t = useTranslations('admin');
  const { data, error, setError, reload } = useLoad(adminSanctioned);
  if (!data) return error ? <ErrorLine code={error} onRetry={() => void reload()} /> : <Loading />;

  const lift = async (u: SanctionedUser, field: keyof UserSanctions) => {
    const res = await setSanctions(u.id, { [field]: null });
    setError(res.ok ? null : res.code);
    await reload();
  };

  return (
    <div className="flex flex-col gap-3">
      <ErrorLine code={error} />
      {data.users.length === 0 && <p className="admin-empty">{t('empty.sanctions')}</p>}
      <ul className="flex flex-col gap-2">
        {data.users.map((u) => (
          <li
            key={u.id}
            className="card flex flex-wrap items-center gap-2 py-3"
            data-testid="admin-sanctioned"
          >
            <span className="font-medium">{u.name}</span>
            <SanctionChips s={u} />
            <span className="ml-auto flex gap-2">
              {u.mutedUntil !== null && (
                <button type="button" className="btn px-2 py-1 text-sm" onClick={() => lift(u, 'mutedUntil')}>
                  {t('unmute')}
                </button>
              )}
              {u.bannedUntil !== null && (
                <button
                  type="button"
                  className="btn px-2 py-1 text-sm"
                  onClick={() => lift(u, 'bannedUntil')}
                >
                  {t('unban')}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
