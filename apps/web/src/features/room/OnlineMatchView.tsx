'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { GAMES, type GameId } from '@/games/catalog';
import { CLIENT_GAMES } from '@/games/client-registry';
import { useSettings } from '@/features/settings/settings-store';
import type { RoomApi } from '@/online/use-room';
import type { RatingChange, SeatOccupant } from '@bg/protocol';
import { Clock, Presence, seatName } from './shared';

/** Rating next to a player's name; after a ranked game, the change (+12 / −8). */
function RatingBadge({ occ, change }: { occ: SeatOccupant | null; change: RatingChange | undefined }) {
  if (change) {
    const diff = change.after - change.before;
    return (
      <span className="text-sm tabular-nums" data-testid="rating-change">
        {change.after}{' '}
        <span className={diff >= 0 ? 'text-green-600' : 'text-[var(--danger)]'}>
          ({diff >= 0 ? '+' : '−'}
          {Math.abs(diff)})
        </span>
      </span>
    );
  }
  if (occ?.kind !== 'user' || occ.rating === undefined) return null;
  return <span className="text-sm tabular-nums text-[var(--muted)]">({occ.rating})</span>;
}

export function OnlineMatchView({ api }: { api: RoomApi }) {
  const t = useTranslations();
  const settings = useSettings();
  const room = api.room!;
  const received = api.match!;
  const m = received.snapshot;
  const gameId = room.gameId as GameId;
  const { Board, PieceIcon } = CLIENT_GAMES[gameId];
  const players = GAMES[gameId].definition.meta.maxPlayers;

  const pieceName = (seat: number) => t(`games.${gameId}.pieces.${seat}`);
  const nameOf = (seat: number) =>
    `${pieceName(seat)} · ${seatName(t, room.seats[seat] ?? null, api.userId, api.labels)}`;
  const reasonText = (reason: string) => {
    const key = `games.${gameId}.reasons.${reason}`;
    if (t.has(key)) return t(key);
    return t.has(`reasons.${reason}`) ? t(`reasons.${reason}`) : reason;
  };

  const active = m.activeSeats[0];
  const status = m.result
    ? m.result.kind === 'win'
      ? t('match.result.win', {
          player: nameOf(m.result.winners[0] ?? 0),
          reason: reasonText(m.result.reason),
        })
      : t('match.result.draw', { reason: reasonText(m.result.reason) })
    : active !== undefined
      ? t('match.turn', { player: nameOf(active) })
      : '';

  const isMyTurn = m.mySeat !== null && m.activeSeats.includes(m.mySeat) && !m.result;
  const playing = !m.result && m.mySeat !== null;
  const offer = m.pendingOffer;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_1fr] lg:gap-x-6">
      <div className="flex flex-col gap-2 lg:col-start-2 lg:row-start-1">
        <p role="status" className={`card py-2.5 font-medium ${m.result ? 'border-[var(--accent)]' : ''}`}>
          {status}
        </p>
        {m.mySeat === null && <p className="text-sm text-[var(--muted)]">{t('room.spectating')}</p>}
      </div>

      <section className="mx-auto w-full max-w-[min(100%,calc(100dvh-10rem))] lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <Board
          view={m.view}
          mySeat={m.mySeat}
          isMyTurn={isMyTurn}
          disabled={api.movePending || api.connection !== 'online'}
          orientation={m.mySeat ?? 0}
          onMove={(move) => void api.submitMove(move)}
          settings={settings}
          t={t}
        />
      </section>

      <aside className="flex flex-col gap-3 lg:col-start-2 lg:row-start-2">
        <ul className="flex flex-col gap-2">
          {Array.from({ length: players }, (_, seat) => {
            const clock = m.clocks?.find((c) => c.seat === seat);
            const isActive = m.activeSeats.includes(seat);
            return (
              <li
                key={seat}
                className={`card flex items-center justify-between gap-2 py-2.5 ${isActive ? 'ring-2 ring-[var(--accent)]' : ''}`}
                aria-current={isActive ? 'true' : undefined}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {PieceIcon ? <PieceIcon seat={seat} size={20} /> : null}
                  <span className="truncate">
                    {seatName(t, room.seats[seat] ?? null, api.userId, api.labels)}
                  </span>
                  <RatingBadge
                    occ={room.seats[seat] ?? null}
                    change={m.ratingChanges?.find((c) => c.seat === seat)}
                  />
                  <Presence occ={room.seats[seat] ?? null} serverOffset={received.serverOffset} t={t} />
                </span>
                {clock && <Clock clock={clock} receivedAt={received.receivedAt} />}
              </li>
            );
          })}
        </ul>

        {offer && playing && offer.from !== m.mySeat && (
          <div className="card flex flex-col gap-2 border-[var(--accent)] py-3">
            <p className="text-sm">{t('room.drawOffered', { player: nameOf(offer.from) })}</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => api.matchAction('accept-draw')}
              >
                {t('room.acceptDraw')}
              </button>
              <button type="button" className="btn" onClick={() => api.matchAction('decline-draw')}>
                {t('room.declineDraw')}
              </button>
            </div>
          </div>
        )}

        {playing && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn"
              disabled={offer?.from === m.mySeat}
              onClick={() => api.matchAction('offer-draw')}
            >
              {offer?.from === m.mySeat ? t('room.drawSent') : t('room.offerDraw')}
            </button>
            <button type="button" className="btn" onClick={() => api.matchAction('resign')}>
              ⚑ {t('match.actions.resign')}
            </button>
          </div>
        )}

        {room.status === 'finished' && (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-primary" onClick={() => api.rematch()}>
              {t('room.rematch')}
            </button>
            <Link href={`/replay/${m.matchId}`} className="btn">
              {t('room.replay')}
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
