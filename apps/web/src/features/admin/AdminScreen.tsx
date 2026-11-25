'use client';

import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import {
  SANCTION_FOREVER,
  SANCTION_HOURS,
  type AdminGameSetting,
  type AdminReport,
  type PublicUser,
  type ReportAction,
  type SanctionedUser,
  type UserSanctions,
} from '@bg/protocol';
import { errorKey } from '@/game-runtime/error-key';
import { GAME_IDS } from '@/games/catalog';
import {
  adminGames,
  adminStats,
  adminReports,
  adminSanctioned,
  resolveReport,
  setGameEnabled,
  setSanctions,
} from '@/online/admin-api';
import { apiRequest } from '@/online/api';
import { useSession } from '@/online/session';

type Tab = 'stats' | 'open' | 'resolved' | 'games' | 'sanctions';
const TABS: Tab[] = ['stats', 'open', 'resolved', 'games', 'sanctions'];

/** /admin (M4b): reports, game switches and current sanctions. The server checks every action. */
export function AdminScreen() {
  const t = useTranslations('admin');
  const token = useSession((s) => s.token);
  const [me, setMe] = useState<PublicUser | null | 'loading'>('loading');
  const [tab, setTab] = useState<Tab>('stats');

  // Re-read the account: the admin flag may be newer than the copy kept in the browser.
  useEffect(() => {
    if (!token) return setMe(null);
    void apiRequest<PublicUser>('GET', '/api/me', undefined, token).then((res) => {
      if (res.ok) useSession.getState().setUser(res.data);
      setMe(res.ok ? res.data : null);
    });
  }, [token]);

  if (me === 'loading') return <p className="px-4 py-20 text-center text-[var(--muted)]">{t('loading')}</p>;
  if (!me?.admin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p role="alert" className="text-lg" data-testid="admin-denied">
          {t('denied')}
        </p>
        <Link href="/account" className="btn mt-6">
          {t('signIn')}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('title')}>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`btn ${tab === id ? 'btn-primary' : ''}`}
            onClick={() => setTab(id)}
            data-testid={`admin-tab-${id}`}
          >
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'stats' ? (
          <Stats />
        ) : tab === 'open' || tab === 'resolved' ? (
          <Reports key={tab} status={tab} />
        ) : tab === 'games' ? (
          <Games />
        ) : (
          <Sanctions />
        )}
      </div>
    </div>
  );
}

/** Visitors of today and of the days before: people not signed in, guests and accounts (docs/05 §2.1). */
function Stats() {
  const t = useTranslations('admin.stats');
  const format = useFormatter();
  const { data, error, reload } = useLoad(adminStats);
  if (!data) return <ErrorLine code={error} />;
  const kinds = ['anonymous', 'guest', 'registered'] as const;
  const peak = Math.max(1, ...data.days.map((d) => d.total));
  const day = (value: string) =>
    format.dateTime(new Date(`${value}T12:00:00+07:00`), { dateStyle: 'medium' });
  return (
    <div className="flex flex-col gap-5" data-testid="admin-stats">
      <section aria-labelledby="stats-today" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="stats-today" className="text-lg font-semibold">
            {t('today')} · {day(data.today.day)}
          </h2>
          <button type="button" className="btn" onClick={() => void reload()}>
            {t('refresh')}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="card py-3" data-testid="stats-total">
            <div className="text-sm text-[var(--muted)]">{t('total')}</div>
            <div className="text-3xl font-bold">{data.today.total}</div>
          </div>
          {kinds.map((k) => (
            <div key={k} className="card py-3" data-testid={`stats-today-${k}`}>
              <div className="text-sm text-[var(--muted)]">{t(k)}</div>
              <div className="text-3xl font-bold">{data.today[k]}</div>
            </div>
          ))}
        </div>
        <p className="text-sm text-[var(--muted)]">
          {t('signedIn', { count: data.today.guest + data.today.registered })}
        </p>
      </section>
      <section aria-labelledby="stats-days" className="flex flex-col gap-2">
        <h2 id="stats-days" className="text-lg font-semibold">
          {t('days', { count: data.days.length })}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" data-testid="stats-days">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="py-1 pr-3 font-medium">{t('day')}</th>
                <th className="px-3 py-1 text-right font-medium">{t('total')}</th>
                {kinds.map((k) => (
                  <th key={k} className="px-3 py-1 text-right font-medium">
                    {t(k)}
                  </th>
                ))}
                <th className="w-1/3 py-1 pl-3" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {data.days.map((d) => (
                <tr key={d.day} className="border-t border-[var(--border)]">
                  <td className="py-1.5 pr-3">{day(d.day)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{d.total}</td>
                  {kinds.map((k) => (
                    <td key={k} className="px-3 py-1.5 text-right">
                      {d[k]}
                    </td>
                  ))}
                  <td className="py-1.5 pl-3" aria-hidden="true">
                    <div
                      className="h-2 rounded bg-[var(--accent)]"
                      style={{ width: `${(d.total / peak) * 100}%` }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-sm text-[var(--muted)]">{t('note')}</p>
    </div>
  );
}

/** Loads a list and keeps the error code of the last failed call. */
function useLoad<T>(load: () => Promise<{ ok: true; data: T } | { ok: false; code: string }>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const res = await load();
    if (res.ok) setData(res.data);
    setError(res.ok ? null : res.code);
  }, [load]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, setData, error, setError, reload };
}

function ErrorLine({ code }: { code: string | null }) {
  const t = useTranslations();
  if (!code) return null;
  return (
    <p role="alert" className="text-sm text-[var(--danger)]">
      {t(errorKey(code))}
    </p>
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

  if (!data) return <ErrorLine code={error} />;
  return (
    <div className="flex flex-col gap-4">
      <ErrorLine code={error} />
      {data.reports.length === 0 && <p className="text-[var(--muted)]">{t(`empty.${status}`)}</p>}
      {data.reports.map((r) => (
        <ReportCard
          key={r.id}
          report={r}
          onDone={async (code) => {
            setError(code);
            await reload();
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

// ---------------------------------------------------------------- games

function Games() {
  const t = useTranslations();
  const { data, setData, error, setError } = useLoad(adminGames);
  if (!data) return <ErrorLine code={error} />;
  const byId = new Map(data.games.map((g) => [g.gameId, g]));
  // Same order as the catalog; games the server has but this web build does not are listed last.
  const ids = [
    ...GAME_IDS.filter((id) => byId.has(id)),
    ...data.games.map((g) => g.gameId).filter((id) => !GAME_IDS.includes(id as never)),
  ];

  const toggle = async (g: AdminGameSetting) => {
    const res = await setGameEnabled(g.gameId, !g.enabled);
    setError(res.ok ? null : res.code);
    if (res.ok) setData({ games: data.games.map((x) => (x.gameId === g.gameId ? res.data : x)) });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--muted)]">{t('admin.gamesHint')}</p>
      <ErrorLine code={error} />
      <ul className="flex flex-col gap-2">
        {ids.map((id) => {
          const g = byId.get(id)!;
          const name = t.has(`games.${id}.name`) ? t(`games.${id}.name`) : id;
          return (
            <li key={id} className="card flex items-center justify-between gap-3 py-3">
              <span className="font-medium">{name}</span>
              <label className="flex items-center gap-2 text-sm">
                <span className={g.enabled ? '' : 'text-[var(--danger)]'}>
                  {g.enabled ? t('admin.on') : t('admin.off')}
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="admin-switch"
                  checked={g.enabled}
                  onChange={() => void toggle(g)}
                  aria-label={t('admin.toggle', { game: name })}
                  data-testid={`admin-game-${id}`}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- sanctions

function Sanctions() {
  const t = useTranslations('admin');
  const { data, error, setError, reload } = useLoad(adminSanctioned);
  if (!data) return <ErrorLine code={error} />;

  const lift = async (u: SanctionedUser, field: keyof UserSanctions) => {
    const res = await setSanctions(u.id, { [field]: null });
    setError(res.ok ? null : res.code);
    await reload();
  };

  return (
    <div className="flex flex-col gap-3">
      <ErrorLine code={error} />
      {data.users.length === 0 && <p className="text-[var(--muted)]">{t('empty.sanctions')}</p>}
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
