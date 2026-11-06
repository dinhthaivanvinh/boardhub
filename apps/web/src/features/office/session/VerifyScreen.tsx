'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Avatar } from '@bg/avatars';
import { commitment, drawPrizes, drawWinners } from '@bg/office-core';
import type { OfficeDrawRecord } from '@bg/protocol';
import { fetchDraw } from '@/office/draw-api';
import { animalLabel, Connecting, useAreaHome } from './shared';

type Check = { commitmentOk: boolean; winnersOk: boolean; again: string[]; prizesOk: boolean | null };

/** Recomputes a draw in this browser, with the same code as the server (ADR-0006). */
function check(d: OfficeDrawRecord): Check {
  const commitmentOk = (() => {
    try {
      return commitment(d.seed) === d.commitment;
    } catch {
      return false;
    }
  })();
  let again: string[];
  try {
    again = drawWinners(
      d.seed,
      d.drawId,
      d.candidates.map((c) => c.id),
      d.n,
    );
  } catch {
    again = [];
  }
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const winnersOk = same(again, d.winners);
  // Draws that also hand out prizes (Lì xì envelopes): the same seed picks each winner's prize.
  let prizesOk: boolean | null = null;
  if (d.prizes || d.awarded) {
    try {
      prizesOk = !!d.prizes && !!d.awarded && same(drawPrizes(d.seed, d.drawId, d.prizes, d.n), d.awarded);
    } catch {
      prizesOk = false;
    }
  }
  return { commitmentOk, winnersOk, again, prizesOk };
}

/** /office/s/[code]/verify/[drawId]: anyone can check that a draw was fair (docs/office/07 §7). */
export function VerifyScreen({ code, drawId }: { code: string; drawId: string }) {
  const t = useTranslations('officeSession.verify');
  const tAvatar = useTranslations('avatar');
  const home = useAreaHome();
  const [state, setState] = useState<{ draw: OfficeDrawRecord; check: Check } | { error: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void fetchDraw(code, drawId).then((res) => {
      if (cancelled) return;
      setState(res.ok ? { draw: res.data, check: check(res.data) } : { error: res.code });
    });
    return () => {
      cancelled = true;
    };
  }, [code, drawId]);

  if (!state) return <Connecting />;
  if ('error' in state) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p role="alert" className="text-lg font-semibold">
          {state.error === 'office.not_found' ? t('notFound') : t('loadFailed')}
        </p>
        <Link href={home} className="btn mt-4">
          ← {t('back')}
        </Link>
      </div>
    );
  }

  const { draw: d, check: c } = state;
  const ok = c.commitmentOk && c.winnersOk && c.prizesOk !== false;
  const nameOf = (id: string) => d.candidates.find((x) => x.id === id)?.name ?? id;
  const time = new Date(d.revealedAt).toLocaleString();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <div>
        <p className="chip chip-accent">
          {t('kicker')} · {code}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
          {t('title', { round: d.round })}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{time}</p>
      </div>

      <div
        className={ok ? 'verify-verdict verify-ok' : 'verify-verdict verify-bad'}
        role="status"
        data-testid="verify-verdict"
        data-ok={ok}
      >
        <span className="text-4xl" aria-hidden="true">
          {ok ? '✓' : '✗'}
        </span>
        <div>
          <p className="text-lg font-bold">{ok ? t('ok') : t('bad')}</p>
          <p className="text-sm">{ok ? t('okDetail') : t('badDetail')}</p>
        </div>
      </div>

      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">{t('winners')}</h2>
        <ul className="flex flex-wrap gap-4">
          {d.winners.map((id, i) => {
            const w = d.candidates.find((x) => x.id === id);
            return (
              <li key={id} className="flex items-center gap-2">
                <span className="text-sm text-[var(--muted)]">#{i + 1}</span>
                {w && <Avatar avatar={w.avatar} size={48} label={animalLabel(tAvatar, w)} />}
                <span className="font-medium">{nameOf(id)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card flex flex-col gap-2 text-sm">
        <h2 className="font-semibold">{t('steps')}</h2>
        <CheckLine ok={c.commitmentOk} label={t('stepCommitment')} />
        <dl className="grid gap-1 pl-6 font-mono text-xs break-all">
          <dt className="text-[var(--muted)]">{t('commitment')}</dt>
          <dd data-testid="verify-commitment">{d.commitment}</dd>
          <dt className="text-[var(--muted)]">{t('seed')}</dt>
          <dd>{d.seed}</dd>
          <dt className="text-[var(--muted)]">drawId</dt>
          <dd>{d.drawId}</dd>
        </dl>
        <CheckLine ok={c.winnersOk} label={t('stepWinners', { n: d.n, total: d.candidates.length })} />
        {!c.winnersOk && (
          <p className="pl-6">
            {t('recomputed')}: {c.again.map(nameOf).join(', ') || '—'}
          </p>
        )}
        {c.prizesOk !== null && (
          <CheckLine ok={c.prizesOk} label={t('stepPrizes', { total: d.prizes?.length ?? 0 })} />
        )}
        <p className="mt-2 text-xs text-[var(--muted)]">{t('how')}</p>
      </section>

      {d.prizes && (
        <section className="card" data-testid="verify-prizes">
          <h2 className="mb-2 font-semibold">{t('prizes', { n: d.prizes.length })}</h2>
          <p className="mb-2 text-sm">
            {t('awarded')}: <strong className="font-mono">{(d.awarded ?? []).join(', ') || '—'}</strong>
          </p>
          <ol className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-x-3 gap-y-1 font-mono text-xs">
            {d.prizes.map((p, i) => (
              <li key={p} className={d.awarded?.includes(p) ? 'font-bold text-[var(--accent)]' : ''}>
                <span className="text-[var(--muted)]">{i}.</span> {p}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-[var(--muted)]">{t('prizesHow')}</p>
        </section>
      )}

      <section className="card">
        <h2 className="mb-2 font-semibold">{t('pool', { n: d.candidates.length })}</h2>
        <ol className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-4 gap-y-1 text-sm">
          {[...d.candidates]
            .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
            .map((p, i) => (
              <li key={p.id} className={d.winners.includes(p.id) ? 'font-bold text-[var(--accent)]' : ''}>
                <span className="text-[var(--muted)]">{i}.</span> {p.name}
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}

function CheckLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className="flex items-start gap-2">
      <span className={ok ? 'text-[var(--success,#16a34a)]' : 'text-[var(--danger)]'} aria-hidden="true">
        {ok ? '✓' : '✗'}
      </span>
      <span>{label}</span>
    </p>
  );
}
