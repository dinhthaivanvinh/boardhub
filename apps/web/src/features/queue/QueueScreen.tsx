'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { TimeControlPreset } from '@bg/protocol';
import { errorKey } from '@/game-runtime/error-key';
import type { GameId } from '@/games/catalog';
import { getSocket, request, type GameSocket } from '@/online/socket';
import { formatClock, useNow } from '@/features/room/shared';

/** Waits in the quick-match queue (FR-ROOM-05) and jumps into the room as soon as a game is found. */
export function QueueScreen({
  gameId,
  preset,
  ranked,
}: {
  gameId: GameId;
  preset: TimeControlPreset;
  ranked: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [since] = useState(() => Date.now());
  const now = useNow(1000, !error);

  useEffect(() => {
    let socket: GameSocket | null = null;
    let matched = false;
    let cancelled = false;
    const onMatched = ({ roomCode }: { roomCode: string }) => {
      matched = true;
      router.replace(`/room/${roomCode}`);
    };
    const join = async () => {
      if (!socket) return;
      const res = await request(socket, 'queue:join', { gameId, timeControl: preset, ranked });
      if (!cancelled && !res.ok) setError(res.code);
    };
    getSocket()
      .then((s) => {
        if (cancelled) return;
        socket = s;
        s.on('queue:matched', onMatched);
        // After a reconnect the server has dropped us from the queue: join again.
        s.on('connect', join);
        if (s.connected) void join();
      })
      .catch((err: unknown) =>
        setError(err instanceof Error && err.message.includes('.') ? err.message : 'network'),
      );
    return () => {
      cancelled = true;
      if (!socket) return;
      socket.off('queue:matched', onMatched);
      socket.off('connect', join);
      if (!matched) void request(socket, 'queue:leave', {});
    };
  }, [gameId, preset, ranked, router]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-20 text-center">
      <h1 className="text-2xl font-bold tracking-tight">
        {t('queue.title', { game: t(`games.${gameId}.name`) })}
      </h1>
      <p className="text-[var(--muted)]">
        {t(`setup.timeControls.${preset}`)} · {ranked ? t('queue.ranked') : t('queue.casual')}
      </p>
      {error ? (
        <p role="alert" className="text-[var(--danger)]">
          {t(errorKey(error))}
        </p>
      ) : (
        <>
          <div
            className="size-16 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--accent)]"
            aria-hidden="true"
          />
          <p role="status" aria-live="polite">
            {t('queue.waiting')} <span className="font-mono tabular-nums">{formatClock(now - since)}</span>
          </p>
        </>
      )}
      <Link href={`/games/${gameId}`} className="btn">
        {t('queue.cancel')}
      </Link>
    </div>
  );
}
