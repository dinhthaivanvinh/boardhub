'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { MatchSummary, UserRating } from '@bg/protocol';
import { errorKey } from '@/game-runtime/error-key';
import { outcomeFor, type Outcome } from '@/game-runtime/replay';
import { isGameId } from '@/games/catalog';
import { CLIENT_GAMES } from '@/games/client-registry';
import { apiRequest } from '@/online/api';
import { ensureToken, useSession } from '@/online/session';
import { LocalHistory } from './LocalHistory';

const BADGE: Record<Outcome, string> = {
  win: 'bg-green-600 text-white',
  loss: 'bg-[var(--danger)] text-white',
  draw: 'bg-[var(--muted)] text-white',
  playing: 'bg-[var(--accent)] text-[var(--accent-fg)]',
};

export function ProfileScreen() {
  const t = useTranslations();
  const user = useSession((s) => s.user);
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ratings, setRatings] = useState<UserRating[]>([]);

  useEffect(() => {
    let cancelled = false;
    ensureToken()
      .then((token) => {
        void apiRequest<{ ratings: UserRating[] }>('GET', '/api/me/ratings', undefined, token).then(
          (r) => !cancelled && r.ok && setRatings(r.data.ratings),
        );
        return apiRequest<{ matches: MatchSummary[] }>('GET', '/api/me/matches?limit=50', undefined, token);
      })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setMatches(res.data.matches);
        else setError(res.code);
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const outcomes = (matches ?? []).map((m) => outcomeFor(m, user?.id ?? null));
  const count = (o: Outcome) => outcomes.filter((x) => x === o).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{user?.displayName ?? t('profile.title')}</h1>
          <p className="text-sm text-[var(--muted)]">
            {user?.kind === 'registered' ? user.email : t('profile.guest')}
          </p>
        </div>
        <Link href="/account" className="btn">
          {t('profile.settings')}
        </Link>
      </div>

      <dl className="grid grid-cols-4 gap-2 text-center">
        {(
          [
            ['played', (matches ?? []).filter((m) => m.status === 'finished').length],
            ['wins', count('win')],
            ['losses', count('loss')],
            ['draws', count('draw')],
          ] as const
        ).map(([key, n]) => (
          <div key={key} className="card px-2 py-3">
            <dt className="text-xs text-[var(--muted)]">{t(`profile.stats.${key}`)}</dt>
            <dd className="text-2xl font-bold tabular-nums" data-testid={`stat-${key}`}>
              {n}
            </dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-2" aria-label={t('profile.ratings')}>
        <h2 className="font-semibold">{t('profile.ratings')}</h2>
        {ratings.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t('profile.noRatings')}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {ratings
              .filter((r) => isGameId(r.gameId))
              .map((r) => (
                <li
                  key={r.gameId}
                  className="card flex items-center justify-between py-3"
                  data-testid="rating-row"
                >
                  <span>{t(`games.${r.gameId}.name`)}</span>
                  <span className="text-right">
                    <span className="text-xl font-bold tabular-nums">
                      {r.rating}
                      {r.provisional ? '?' : ''}
                    </span>
                    <span className="block text-xs text-[var(--muted)] tabular-nums">
                      {r.wins}/{r.losses}/{r.draws}
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t('profile.history')}</h2>
        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {t(errorKey(error))}
          </p>
        )}
        {matches === null && !error && <p className="text-[var(--muted)]">{t('replay.loading')}</p>}
        {matches?.length === 0 && <p className="text-[var(--muted)]">{t('profile.empty')}</p>}
        <ul className="flex flex-col gap-2">
          {matches?.map((m, i) => {
            if (!isGameId(m.gameId)) return null;
            const outcome = outcomes[i] ?? 'playing';
            const mine = m.players.find((p) => p.userId === user?.id);
            const opponents = m.players
              .filter((p) => p !== mine)
              .map((p) =>
                p.botLevel ? t('room.bot', { level: t(`bot.level.${p.botLevel}`) }) : (p.name ?? '?'),
              )
              .join(', ');
            const { PieceIcon } = CLIENT_GAMES[m.gameId];
            const href = m.status === 'finished' ? `/replay/${m.id}` : `/room/${m.roomCode}`;
            return (
              <li key={m.id} data-game={m.gameId}>
                <Link
                  href={href}
                  className="card flex items-center gap-3 py-3 transition-shadow hover:shadow-md"
                  data-testid="history-row"
                >
                  {PieceIcon && mine ? <PieceIcon seat={mine.seat} size={24} /> : null}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{t(`games.${m.gameId}.name`)}</span>
                    <span className="truncate text-sm text-[var(--muted)]">
                      {t('profile.vs', { names: opponents })} · {new Date(m.startedAt).toLocaleDateString()}
                    </span>
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[outcome]}`}>
                    {t(`profile.outcome.${outcome}`)}
                  </span>
                  <span className="text-sm underline underline-offset-4">
                    {m.status === 'finished' ? t('profile.replay') : t('profile.rejoin')}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <LocalHistory />
    </div>
  );
}
