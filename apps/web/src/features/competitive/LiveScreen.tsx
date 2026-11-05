'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { LiveRoom } from '@bg/protocol';
import { errorKey } from '@/game-runtime/error-key';
import { isGameId } from '@/games/catalog';
import { CLIENT_GAMES } from '@/games/client-registry';
import { apiRequest } from '@/online/api';

const REFRESH_MS = 5_000;

/** Public games in progress; open one to watch it as a spectator (FR-ROOM-06). */
export function LiveScreen() {
  const t = useTranslations();
  const [rooms, setRooms] = useState<LiveRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      void apiRequest<{ rooms: LiveRoom[] }>('GET', '/api/live').then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setRooms(res.data.rooms);
          setError(null);
        } else setError(res.code);
      });
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('live.title')}</h1>
        <p className="text-sm text-[var(--muted)]">{t('live.subtitle')}</p>
      </div>
      {error && (
        <p role="alert" className="text-[var(--danger)]">
          {t(errorKey(error))}
        </p>
      )}
      {rooms?.length === 0 && <p className="text-[var(--muted)]">{t('live.empty')}</p>}
      <ul className="flex flex-col gap-2">
        {rooms?.map((r) => {
          if (!isGameId(r.gameId)) return null;
          const { PieceIcon } = CLIENT_GAMES[r.gameId];
          return (
            <li key={r.roomId} data-game={r.gameId}>
              <Link
                href={`/room/${r.code}`}
                className="card flex items-center gap-3 py-3 hover:shadow-md"
                data-testid="live-row"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">
                    {t(`games.${r.gameId}.name`)}
                    {r.ranked && (
                      <span className="ml-2 text-xs text-[var(--accent)]">{t('queue.ranked')}</span>
                    )}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 text-sm text-[var(--muted)]">
                    {r.players.map((p) => (
                      <span key={p.seat} className="inline-flex items-center gap-1">
                        {PieceIcon ? <PieceIcon seat={p.seat} size={16} /> : null}
                        {p.name}
                        {p.rating !== null && <span className="tabular-nums">({p.rating})</span>}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {t('room.spectators', { n: r.spectatorCount })}
                </span>
                <span className="btn px-3 py-1 text-sm">{t('live.watch')}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
