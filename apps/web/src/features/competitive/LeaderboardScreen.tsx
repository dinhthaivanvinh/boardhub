'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { LeaderboardEntry } from '@bg/protocol';
import { errorKey } from '@/game-runtime/error-key';
import { GAME_IDS, type GameId } from '@/games/catalog';
import { apiRequest } from '@/online/api';
import { useSession } from '@/online/session';
import { useHydrated } from '@/features/account/use-hydrated';

export type LeaderboardData = { entries: LeaderboardEntry[]; minGames: number };

/**
 * Rankings of one game. The page renders it on the server with the data already in (so search engines
 * see the table); the browser only fetches when the server could not reach the game server.
 */
export function LeaderboardScreen({ gameId, initial }: { gameId: GameId; initial: LeaderboardData | null }) {
  const t = useTranslations();
  const hydrated = useHydrated();
  const myId = useSession((s) => s.user?.id ?? null);
  // Highlighting "you" waits for hydration: the server does not know who you are.
  const me = hydrated ? myId : null;
  const [data, setData] = useState<LeaderboardData | null>(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    void apiRequest<LeaderboardData>('GET', `/api/leaderboard/${gameId}`).then((res) => {
      if (cancelled) return;
      if (res.ok) setData(res.data);
      else setError(res.code);
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, initial]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{t('leaderboard.title')}</h1>
      <h2 className="sr-only">{t(`games.${gameId}.name`)}</h2>
      {/* Real links, one page per game, so every ranking can be found and shared. */}
      <nav className="flex flex-wrap gap-2" aria-label={t('leaderboard.games')}>
        {GAME_IDS.map((id) => (
          <Link
            key={id}
            href={`/leaderboard?game=${id}`}
            scroll={false}
            aria-current={id === gameId ? 'page' : undefined}
            className={`btn ${id === gameId ? 'btn-primary' : ''}`}
          >
            {t(`games.${id}.name`)}
          </Link>
        ))}
      </nav>
      {error && (
        <p role="alert" className="text-[var(--danger)]">
          {t(errorKey(error))}
        </p>
      )}
      {data && data.entries.length === 0 && (
        <p className="text-[var(--muted)]">{t('leaderboard.empty', { n: data.minGames })}</p>
      )}
      {data && data.entries.length > 0 && (
        <table className="card w-full border-separate border-spacing-0 p-0 text-sm">
          <thead>
            <tr className="text-left text-[var(--muted)]">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">{t('leaderboard.player')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('leaderboard.rating')}</th>
              <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">
                {t('leaderboard.record')}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((e) => (
              <tr
                key={e.userId}
                className={e.userId === me ? 'bg-[var(--bg)] font-semibold' : ''}
                data-testid="leaderboard-row"
              >
                <td className="border-t border-[var(--border)] px-4 py-2 tabular-nums">{e.rank}</td>
                <td className="border-t border-[var(--border)] px-4 py-2">{e.name}</td>
                <td className="border-t border-[var(--border)] px-4 py-2 text-right tabular-nums">
                  {e.rating}
                  {e.provisional ? '?' : ''}
                </td>
                <td className="hidden border-t border-[var(--border)] px-4 py-2 text-right tabular-nums sm:table-cell">
                  {e.wins}/{e.losses}/{e.draws}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
