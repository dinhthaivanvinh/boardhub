'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { BOT_LEVELS, type BotLevel } from '@bg/bots';
import { GAMES, type GameId } from '@/games/catalog';
import { CLIENT_GAMES } from '@/games/client-registry';
import type { RoomApi } from '@/online/use-room';
import { InviteBox } from './InviteBox';
import { Presence, seatName, timeControlLabel } from './shared';

export function Lobby({ api }: { api: RoomApi }) {
  const t = useTranslations();
  const room = api.room!;
  const gameId = room.gameId as GameId;
  const { minPlayers } = GAMES[gameId].definition.meta;
  const { PieceIcon } = CLIENT_GAMES[gameId];
  const [botLevel, setBotLevel] = useState<BotLevel>('medium');

  const filled = room.seats.findIndex((s) => s === null);
  const players = filled === -1 ? room.seats.length : filled;
  const enoughPlayers = players >= minPlayers && room.seats.slice(players).every((s) => s === null);
  const everyoneReady = room.seats.every((s) => s?.kind !== 'user' || s.ready || s.userId === room.hostId);
  const me = api.mySeat !== null ? room.seats[api.mySeat] : null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InviteBox code={room.code} />

      <section className="card flex flex-col gap-3">
        <h2 className="font-medium">{t('room.players')}</h2>
        <ul className="flex flex-col gap-2">
          {room.seats.map((occ, seat) => (
            <li
              key={seat}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
              data-testid={`seat-${seat}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {PieceIcon ? <PieceIcon seat={seat} size={20} /> : null}
                <span className="truncate">
                  {seatName(t, occ, api.userId, api.labels)}
                  {occ?.kind === 'user' && occ.rating !== undefined && (
                    <span className="ml-1 text-sm tabular-nums text-[var(--muted)]">({occ.rating})</span>
                  )}
                  {occ?.kind === 'user' && occ.userId === room.hostId && (
                    <span className="ml-1 text-xs text-[var(--muted)]">· {t('room.host')}</span>
                  )}
                </span>
                {occ?.kind === 'user' && occ.userId !== room.hostId && (
                  <span className={`text-xs ${occ.ready ? 'text-green-600' : 'text-[var(--muted)]'}`}>
                    {occ.ready ? `✓ ${t('room.ready')}` : t('room.notReady')}
                  </span>
                )}
                <Presence occ={occ} serverOffset={0} t={t} />
              </span>
              <span className="flex shrink-0 gap-1">
                {!occ && api.mySeat === null && (
                  <button type="button" className="btn px-2 py-1 text-xs" onClick={() => api.takeSeat(seat)}>
                    {t('room.sitHere')}
                  </button>
                )}
                {!occ && api.isHost && (
                  <button
                    type="button"
                    className="btn px-2 py-1 text-xs"
                    onClick={() => api.addBot(seat, botLevel)}
                  >
                    {t('room.addBot')}
                  </button>
                )}
                {occ?.kind === 'bot' && api.isHost && (
                  <button type="button" className="btn px-2 py-1 text-xs" onClick={() => api.removeBot(seat)}>
                    {t('room.removeBot')}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>

        {api.isHost && room.seats.some((s) => s === null) && (
          <label className="flex items-center justify-between gap-2 text-sm">
            {t('setup.level')}
            <select
              className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1"
              value={botLevel}
              onChange={(e) => setBotLevel(e.target.value as BotLevel)}
            >
              {BOT_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(`bot.level.${l}`)}
                </option>
              ))}
            </select>
          </label>
        )}

        <p className="text-sm text-[var(--muted)]">
          {t('room.timeControl', { tc: timeControlLabel(t, room.timeControl) })}
          {room.spectatorCount > 0 && <> · {t('room.spectators', { n: room.spectatorCount })}</>}
        </p>

        <div className="flex flex-wrap gap-2">
          {me?.kind === 'user' && !api.isHost && (
            <button type="button" className="btn btn-primary" onClick={() => api.setReady(!me.ready)}>
              {me.ready ? t('room.unsetReady') : t('room.setReady')}
            </button>
          )}
          {api.mySeat !== null && (
            <button type="button" className="btn" onClick={() => api.takeSeat(null)}>
              {t('room.standUp')}
            </button>
          )}
          {api.isHost && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!enoughPlayers || !everyoneReady}
              onClick={() => api.start()}
            >
              {t('room.start')}
            </button>
          )}
        </div>
        {api.isHost && (!enoughPlayers || !everyoneReady) && (
          <p className="text-sm text-[var(--muted)]">
            {!enoughPlayers ? t('room.needPlayers') : t('room.needReady')}
          </p>
        )}
        {!api.isHost && <p className="text-sm text-[var(--muted)]">{t('room.waitingHost')}</p>}
      </section>
    </div>
  );
}
