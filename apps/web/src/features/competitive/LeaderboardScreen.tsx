'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { LeaderboardEntry } from '@bg/protocol';
import { errorKey } from '@/game-runtime/error-key';
import { GAME_IDS, type GameId } from '@/games/catalog';
import { apiRequest } from '@/online/api';
import { useSession } from '@/online/session';

export function LeaderboardScreen({ initialGame }: { initialGame: GameId }) {
  const t = useTranslations();
  const me = useSession((s) => s.user?.id ?? null);
  const [gameId, setGameId] = useState<GameId>(initialGame);
  const [data, setData] = useState<{ entries: LeaderboardEntry[]; minGames: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    void apiRequest<{ entries: LeaderboardEntry[]; minGames: number }>(
      'GET',
      `/api/leaderboard/${gameId}`,
    ).then((res) => {
      if (cancelled) return;
      if (res.ok) setData(res.data);
      else setError(res.code);
    });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{t('leaderboard.title')}</h1>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('leaderboard.games')}>
        {GAME_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === gameId}
            className={`btn ${id === gameId ? 'btn-primary' : ''}`}
            onClick={() => setGameId(id)}
          >
            {t(`games.${id}.name`)}
          </button>
        ))}
      </div>
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
