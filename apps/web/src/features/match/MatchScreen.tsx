'use client';

import { BoardStage } from '@/components/BoardStage';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef } from 'react';
import type { GameResult, Seat } from '@bg/engine';
import { GAMES, type GameId } from '@/games/catalog';
import { CLIENT_GAMES } from '@/games/client-registry';
import { controllersFor, type MatchSetup, type SeatController } from '@/game-runtime/match-setup';
import { useLocalMatch } from '@/game-runtime/use-local-match';
import { useSettings } from '@/features/settings/settings-store';
import { errorKey } from '@/game-runtime/error-key';
import { RulesButton } from '@/features/rules/RulesButton';
import { playSound } from '@/sound/play';
import { SoundControls } from '@/sound/SoundControls';
import { useGameSound } from '@/sound/use-game-sound';
import { resultDetail } from './result-detail';
import { useCoach } from './use-coach';
import { ResultOverlay, type ResultTone } from './ResultOverlay';

export function MatchScreen({ gameId, setup }: { gameId: GameId; setup: MatchSetup }) {
  const t = useTranslations();
  const { definition } = GAMES[gameId];
  const { Board, PieceIcon, moveSounds, music, coach } = CLIENT_GAMES[gameId];
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

  // The result, in the middle of the board. Against the computer it is told from your side.
  const boardRef = useRef<HTMLElement>(null);
  const result = snapshot.result;
  const winner = result?.kind === 'win' ? (result.winners[0] ?? 0) : null;
  const tone: ResultTone =
    result?.kind === 'draw'
      ? 'draw'
      : setup.mode !== 'bot'
        ? 'neutral'
        : winner === setup.humanSeat
          ? 'win'
          : 'loss';
  const overlayTitle =
    tone === 'draw'
      ? t('match.overlay.draw')
      : tone === 'win'
        ? t('match.overlay.youWin')
        : tone === 'loss'
          ? t('match.overlay.youLose')
          : t('match.overlay.wins', { player: seatName(winner ?? 0) });

  const view = definition.playerView(snapshot.state, viewer);
  // Only against the computer: between two people it would not be fair.
  const help = useCoach({
    coach: setup.mode === 'bot' ? coach : undefined,
    state: snapshot.state,
    version: snapshot.version,
    view,
    seat: viewer,
    active: isMyTurn,
    showWarnings: settings.showThreats,
    speak: settings.speakCoach,
    gameKey: snapshot.seed,
  });
  const sound = useGameSound({ view, moveSounds, music, outcome: result ? tone : null });
  // A refused move gets a soft "no".
  useEffect(() => {
    if (match.error) playSound('invalid');
  }, [match.error]);

  return (
    // Mobile: title + status above the board, everything else below. Desktop: board left, panel right.
    <div
      data-game={gameId}
      className={`stage-screen ${gameId === 'chess' ? 'adv-page play-scene ' : ''}mx-auto grid max-w-[90rem] gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-x-6 lg:py-6`}
    >
      <BoardStage />
      <div className="play-head flex flex-col gap-2 lg:col-start-2 lg:row-start-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">{t(`games.${gameId}.name`)}</h1>
          <RulesButton gameId={gameId} config={setup.config} />
        </div>
        <p
          role="status"
          className={`card py-2 text-base font-medium ${snapshot.result ? 'border-[var(--accent)]' : ''}`}
        >
          {status}
        </p>
        {match.error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {t(errorKey(match.error))}
          </p>
        )}
      </div>

      <section
        ref={boardRef}
        className="play-board relative mx-auto w-full max-w-[min(100%,calc(100dvh-8rem))] lg:sticky lg:top-[4.5rem] lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start"
      >
        <Board
          view={view}
          mySeat={viewer}
          playSound={sound}
          isMyTurn={isMyTurn}
          disabled={match.botThinking}
          // Hot-seat keeps one orientation; turning the board every move is disorienting.
          orientation={setup.mode === 'bot' ? setup.humanSeat : 0}
          onMove={match.play}
          settings={settings}
          t={t}
          assist={help.assist}
        />
        <ResultOverlay
          show={result !== null}
          tone={tone}
          title={overlayTitle}
          detail={
            result
              ? resultDetail(t, tone, result.reason, {
                  loserName: seatName(controllers.findIndex((_, s) => s !== winner)),
                  reasonText,
                })
              : ''
          }
          icon={winner !== null && PieceIcon ? <PieceIcon seat={winner} size={40} /> : undefined}
          boardRef={boardRef}
        />
      </section>

      <aside className="stage-aside flex flex-col gap-3 lg:col-start-2 lg:row-start-2">
        <ul className="grid grid-cols-2 gap-2">
          {controllers.map((_, seat) => {
            const isActive = snapshot.activeSeats.includes(seat);
            return (
              <li
                key={seat}
                className={`card flex items-center justify-between py-2 ${isActive ? 'ring-2 ring-[var(--accent)]' : ''}`}
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

        {help.available && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="btn"
              onClick={help.askHint}
              disabled={!isMyTurn || snapshot.result !== null || help.hintShown || help.hintsLeft === 0}
              data-testid="coach-hint"
            >
              <span aria-hidden="true">💡</span> {t('match.coach.hint', { left: help.hintsLeft })}
            </button>
            {/* Always there, so screen readers hear what appears in it. */}
            <div aria-live="polite" data-testid="coach-message">
              {help.messages.length > 0 && (
                <div className="card flex flex-col gap-1 py-2 text-sm font-medium">
                  {help.messages.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                  {help.sayAgain && (
                    <button type="button" className="btn self-start text-sm" onClick={help.sayAgain}>
                      <span aria-hidden="true">🔊</span> {t('match.coach.again')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <button type="button" className="btn" onClick={match.undo} disabled={!match.canUndo}>
            ↶ {t('match.actions.undo')}
          </button>
          <button type="button" className="btn btn-primary" onClick={match.newGame}>
            {t('match.actions.newGame')}
          </button>
          <button
            type="button"
            className="btn"
            onClick={match.resign}
            disabled={snapshot.result !== null || !isMyTurn}
          >
            ⚑ {t('match.actions.resign')}
          </button>
        </div>

        <details className="card py-2 text-sm">
          <summary className="cursor-pointer font-medium">{t('match.settings.title')}</summary>
          <div className="mt-2 flex flex-col gap-2">
            <SoundControls />

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  checked={settings.confirmMove}
                  onChange={(e) => settings.update({ confirmMove: e.target.checked })}
                />
                {t('match.settings.confirmMove')}
              </label>
              {help.available && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--accent)]"
                    checked={settings.showThreats}
                    onChange={(e) => settings.update({ showThreats: e.target.checked })}
                  />
                  {t('match.coach.showThreats')}
                </label>
              )}
              {help.available && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--accent)]"
                    checked={settings.speakCoach}
                    onChange={(e) => settings.update({ speakCoach: e.target.checked })}
                  />
                  {t('match.coach.speak')}
                </label>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  checked={settings.animations}
                  onChange={(e) => settings.update({ animations: e.target.checked })}
                />
                {t('match.settings.animations')}
              </label>
            </div>
          </div>
        </details>

        {match.replayHref && (
          <Link href={match.replayHref} className="btn" data-testid="local-replay">
            {t('room.replay')}
          </Link>
        )}

        <Link href={`/games/${gameId}`} className="text-sm underline underline-offset-4">
          {t('match.actions.changeSetup')}
        </Link>
      </aside>
    </div>
  );
}
