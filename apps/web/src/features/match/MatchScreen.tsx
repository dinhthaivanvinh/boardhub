'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { GameResult, Seat } from '@bg/engine';
import { GAMES, type GameId } from '@/games/catalog';
import { CLIENT_GAMES } from '@/games/client-registry';
import { controllersFor, type MatchSetup, type SeatController } from '@/game-runtime/match-setup';
import { useLocalMatch } from '@/game-runtime/use-local-match';
import { useSettings } from '@/features/settings/settings-store';
import { errorKey } from '@/game-runtime/error-key';

export function MatchScreen({ gameId, setup }: { gameId: GameId; setup: MatchSetup }) {
  const t = useTranslations();
  const { definition } = GAMES[gameId];
  const { Board, PieceIcon } = CLIENT_GAMES[gameId];
  const controllers = useMemo(() => controllersFor(setup, definition.meta.minPlayers), [setup, definition]);
  const match = useLocalMatch(gameId, definition, setup.config, controllers);
  const settings = useSettings();
  const { snapshot } = match;

  const pieceName = (seat: Seat) => t(`games.${gameId}.pieces.${seat}`);
  const seatName = (seat: Seat) => {
    const c: SeatController | undefined = controllers[seat];
    if (c?.kind === 'bot') return t('match.bot', { level: t(`bot.level.${c.level}`) });
    return setup.mode === 'bot' ? t('match.you') : t('match.player', { n: seat + 1 });
  };
  const fullName = (seat: Seat) => `${pieceName(seat)} · ${seatName(seat)}`;
  const reasonText = (reason: string) => {
    const gameKey = `games.${gameId}.reasons.${reason}`;
    if (t.has(gameKey)) return t(gameKey);
    return t.has(`reasons.${reason}`) ? t(`reasons.${reason}`) : reason;
  };

  const active = snapshot.activeSeats[0];
  const status = statusText(snapshot.result, active);
  function statusText(result: GameResult | null, seat: Seat | undefined): string {
    if (result?.kind === 'win') {
      return t('match.result.win', {
        player: fullName(result.winners[0] ?? 0),
        reason: reasonText(result.reason),
      });
    }
    if (result?.kind === 'draw') return t('match.result.draw', { reason: reasonText(result.reason) });
    if (seat === undefined) return '';
    return match.botThinking
      ? t('match.thinking', { player: fullName(seat) })
      : t('match.turn', { player: fullName(seat) });
  }

  // Hot-seat: show the board from the side to move. Bot mode: always from the human's side.
  const viewer: Seat = setup.mode === 'bot' ? setup.humanSeat : (match.humanToMove ?? 0);
  const isMyTurn = match.humanToMove !== null;

  return (
    // Mobile: title + status above the board, everything else below. Desktop: board left, panel right.
    <div
      data-game={gameId}
      className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_1fr] lg:gap-x-6 lg:py-6"
    >
      <div className="flex flex-col gap-2 lg:col-start-2 lg:row-start-1">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">{t(`games.${gameId}.name`)}</h1>
        <p
          role="status"
          className={`card py-2.5 text-base font-medium lg:py-3 ${snapshot.result ? 'border-[var(--accent)]' : ''}`}
        >
          {status}
        </p>
        {match.error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {t(errorKey(match.error))}
          </p>
        )}
      </div>

      <section className="mx-auto w-full max-w-[min(100%,calc(100dvh-8rem))] lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <Board
          view={definition.playerView(snapshot.state, viewer)}
          mySeat={viewer}
          isMyTurn={isMyTurn}
          disabled={match.botThinking}
          // Hot-seat keeps one orientation; turning the board every move is disorienting.
          orientation={setup.mode === 'bot' ? setup.humanSeat : 0}
          onMove={match.play}
          settings={settings}
          t={t}
        />
      </section>

      <aside className="flex flex-col gap-4 lg:col-start-2 lg:row-start-2">
        <ul className="flex flex-col gap-2">
          {controllers.map((_, seat) => {
            const isActive = snapshot.activeSeats.includes(seat);
            return (
              <li
                key={seat}
                className={`card flex items-center justify-between py-3 ${isActive ? 'ring-2 ring-[var(--accent)]' : ''}`}
                aria-current={isActive ? 'true' : undefined}
              >
                <span className="flex items-center gap-3">
                  <span
                    className="inline-flex size-8 items-center justify-center rounded-full border border-[var(--border)] font-bold"
                    style={{ color: `var(--piece-p${seat})` }}
                  >
                    {PieceIcon ? <PieceIcon seat={seat} size={22} /> : pieceName(seat)}
                  </span>
                  <span>
                    {seatName(seat)}
                    <span className="text-[var(--muted)]"> · {pieceName(seat)}</span>
                  </span>
                </span>
                {isActive && match.botThinking && controllers[seat]?.kind === 'bot' && (
                  <span className="size-2 animate-ping rounded-full bg-[var(--accent)]" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ul>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn" onClick={match.undo} disabled={!match.canUndo}>
            ↶ {t('match.actions.undo')}
          </button>
          <button type="button" className="btn btn-primary" onClick={match.newGame}>
            {t('match.actions.newGame')}
          </button>
          <button
            type="button"
            className="btn col-span-2"
            onClick={match.resign}
            disabled={snapshot.result !== null || !isMyTurn}
          >
            ⚑ {t('match.actions.resign')}
          </button>
        </div>

        <fieldset className="card flex flex-col gap-2 py-3 text-sm">
          <legend className="px-1 font-medium">{t('match.settings.title')}</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent)]"
              checked={settings.confirmMove}
              onChange={(e) => settings.update({ confirmMove: e.target.checked })}
            />
            {t('match.settings.confirmMove')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent)]"
              checked={settings.animations}
              onChange={(e) => settings.update({ animations: e.target.checked })}
            />
            {t('match.settings.animations')}
          </label>
        </fieldset>

        <Link href={`/games/${gameId}`} className="text-sm underline underline-offset-4">
          {t('match.actions.changeSetup')}
        </Link>
      </aside>
    </div>
  );
}
