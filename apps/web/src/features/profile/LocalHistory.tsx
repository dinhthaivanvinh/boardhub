'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import {
  clearLocalMatches,
  humanSeatOf,
  listLocalMatches,
  localOutcome,
  type LocalMatchRecord,
} from '@/game-runtime/local-history';
import { isGameId } from '@/games/catalog';
import { CLIENT_GAMES } from '@/games/client-registry';

const BADGE = {
  win: 'bg-green-600 text-white',
  loss: 'bg-[var(--danger)] text-white',
  draw: 'bg-[var(--muted)] text-white',
  played: 'bg-[var(--accent)] text-[var(--accent-fg)]',
} as const;

/** Games against the computer and at one screen, saved in this browser only (game-runtime/local-history). */
export function LocalHistory() {
  const t = useTranslations();
  const [games, setGames] = useState<LocalMatchRecord[] | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listLocalMatches().then((list) => !cancelled && setGames(list));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="flex flex-col gap-2" aria-label={t('profile.localHistory')}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t('profile.localHistory')}</h2>
        {games && games.length > 0 && (
          <button
            type="button"
            className="btn px-2 py-1 text-xs"
            onClick={async () => {
              if (!confirm) return setConfirm(true);
              await clearLocalMatches();
              setGames([]);
              setConfirm(false);
            }}
          >
            {confirm ? t('profile.clearConfirm') : t('profile.clearLocal')}
          </button>
        )}
      </div>
      {games === null && <p className="text-[var(--muted)]">{t('replay.loading')}</p>}
      {games?.length === 0 && <p className="text-[var(--muted)]">{t('profile.localEmpty')}</p>}
      <ul className="flex flex-col gap-2">
        {games?.map((g) => {
          if (!isGameId(g.gameId)) return null;
          const outcome = localOutcome(g);
          const seat = humanSeatOf(g);
          const bot = g.players.find((p) => p.botLevel)?.botLevel;
          const { PieceIcon } = CLIENT_GAMES[g.gameId];
          const winner = g.result.kind === 'win' ? (g.result.winners[0] ?? 0) : 0;
          return (
            <li key={g.id} data-game={g.gameId}>
              <Link
                href={`/replay/local/${g.id}`}
                className="card flex items-center gap-3 py-3 transition-shadow hover:shadow-md"
                data-testid="local-history-row"
              >
                {PieceIcon && seat !== null ? <PieceIcon seat={seat} size={24} /> : null}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{t(`games.${g.gameId}.name`)}</span>
                  <span className="truncate text-sm text-[var(--muted)]">
                    {bot
                      ? t('profile.vs', { names: t('room.bot', { level: t(`bot.level.${bot}`) }) })
                      : t('profile.hotSeat')}{' '}
                    · {new Date(g.endedAt).toLocaleDateString()}
                  </span>
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[outcome]}`}>
                  {outcome === 'played'
                    ? t('profile.seatWon', { n: winner + 1 })
                    : t(`profile.outcome.${outcome}`)}
                </span>
                <span className="text-sm underline underline-offset-4">{t('profile.replay')}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-[var(--muted)]">{t('profile.localNote')}</p>
    </section>
  );
}
