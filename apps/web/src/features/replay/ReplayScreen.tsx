'use client';

import { BoardStage } from '@/components/BoardStage';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import type { MatchDetail } from '@bg/protocol';
import { DEFAULT_BOARD_SETTINGS } from '@bg/ui';
import { errorKey } from '@/game-runtime/error-key';
import { RulesButton } from '@/features/rules/RulesButton';
import { asMatchDetail, getLocalMatch, humanSeatOf } from '@/game-runtime/local-history';
import { buildReplay } from '@/game-runtime/replay';
import { useGameSound } from '@/sound/use-game-sound';
import { GAMES, isGameId } from '@/games/catalog';
import { CLIENT_GAMES } from '@/games/client-registry';
import { apiRequest } from '@/online/api';
import { useSession } from '@/online/session';

type Loaded = { match: MatchDetail; mySeat: number | null; local: LocalInfo | null } | { error: string };
interface LocalInfo {
  mode: 'bot' | 'local';
}

/** An online match from the server (finished matches only). */
export function ReplayScreen({ matchId }: { matchId: string }) {
  const userId = useSession((s) => s.user?.id ?? null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let cancelled = false;
    void apiRequest<MatchDetail>('GET', `/api/matches/${matchId}`).then((res) => {
      if (cancelled) return;
      setLoaded(res.ok ? { match: res.data, mySeat: null, local: null } : { error: res.code });
    });
    return () => {
      cancelled = true;
    };
  }, [matchId]);
  if (loaded && 'match' in loaded) {
    const mySeat = loaded.match.players.find((p) => p.userId === userId)?.seat ?? null;
    return <ReplayView key={`${matchId}:ready`} {...loaded} mySeat={mySeat} />;
  }
  return <ReplayView key={matchId} loaded={loaded} />;
}

/** A game played against the computer or at one screen, saved in this browser (local-history.ts). */
export function LocalReplayScreen({ id }: { id: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getLocalMatch(id).then((rec) => {
      if (cancelled) return;
      setLoaded(
        rec
          ? { match: asMatchDetail(rec), mySeat: humanSeatOf(rec), local: { mode: rec.mode } }
          : { error: 'replay.local_missing' },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  if (loaded && 'match' in loaded) return <ReplayView key={`${id}:ready`} {...loaded} />;
  return <ReplayView key={id} loaded={loaded} />;
}

function ReplayView(
  props: { match: MatchDetail; mySeat: number | null; local: LocalInfo | null } | { loaded: Loaded | null },
) {
  const t = useTranslations();
  const match = 'match' in props ? props.match : null;
  const mySeat = 'match' in props ? props.mySeat : null;
  const local = 'match' in props ? props.local : null;
  const loadError =
    'loaded' in props && props.loaded && 'error' in props.loaded
      ? props.loaded.error
      : match && !isGameId(match.gameId)
        ? 'game.not_found'
        : null;
  const [index, setIndex] = useState(() => match?.moves.length ?? 0);
  const [playing, setPlaying] = useState(false);

  const replay = useMemo(() => {
    if (!match || !isGameId(match.gameId)) return null;
    try {
      return { states: buildReplay(GAMES[match.gameId].definition, match) };
    } catch {
      return { error: 'replay.broken' };
    }
  }, [match]);
  const last = replay?.states ? replay.states.length - 1 : 0;

  // Stepping forward one move sounds like that move (no music, no jingle in a replay).
  const gameOk = match && isGameId(match.gameId) ? match.gameId : null;
  const shownState = replay?.states?.[index];
  const shownView = useMemo(
    () =>
      gameOk && shownState !== undefined
        ? GAMES[gameOk].definition.playerView(shownState, mySeat ?? 'spectator')
        : null,
    [gameOk, shownState, mySeat],
  );
  const sound = useGameSound({
    view: shownView,
    moveSounds: gameOk ? CLIENT_GAMES[gameOk].moveSounds : undefined,
    music: null,
    outcome: null,
  });

  // Autoplay one move every 0.8 s; stops at the end.
  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setIndex((i) => Math.min(i + 1, last)), 800);
    return () => clearTimeout(id);
  }, [playing, index, last]);

  // Arrow keys step through the moves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const step: Record<string, (i: number) => number> = {
        ArrowLeft: (i) => i - 1,
        ArrowRight: (i) => i + 1,
        Home: () => 0,
        End: () => last,
      };
      const fn = step[e.key];
      if (!fn) return;
      e.preventDefault();
      setPlaying(false);
      setIndex((i) => Math.max(0, Math.min(last, fn(i))));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last]);

  if (loadError || replay?.error) {
    const code = loadError ?? replay?.error ?? 'internal';
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p role="alert">
          {code === 'replay.broken'
            ? t('replay.broken')
            : code === 'replay.local_missing'
              ? t('replay.localMissing')
              : t(errorKey(code))}
        </p>
        <Link href="/profile" className="btn mt-6">
          {t('replay.back')}
        </Link>
      </div>
    );
  }
  if (!match || !replay?.states || !isGameId(match.gameId)) {
    return <p className="px-4 py-20 text-center text-[var(--muted)]">{t('replay.loading')}</p>;
  }

  const gameId = match.gameId;
  const { definition } = GAMES[gameId];
  const { Board, PieceIcon } = CLIENT_GAMES[gameId];
  const state = replay.states[index];
  const playerName = (seat: number) => {
    const p = match.players.find((x) => x.seat === seat);
    if (!p) return '';
    if (p.botLevel) return t('room.bot', { level: t(`bot.level.${p.botLevel}`) });
    // Local games have no names: "Bạn" against the computer, "Người chơi N" at one screen.
    if (local) return local.mode === 'bot' ? t('match.you') : t('match.player', { n: seat + 1 });
    return p.name ?? '?';
  };
  const reasonText = (reason: string) => {
    const key = `games.${gameId}.reasons.${reason}`;
    if (t.has(key)) return t(key);
    return t.has(`reasons.${reason}`) ? t(`reasons.${reason}`) : reason;
  };
  const result = match.result;
  const resultText = !result
    ? ''
    : result.kind === 'win'
      ? t('match.result.win', {
          player: `${t(`games.${gameId}.pieces.${result.winners[0] ?? 0}`)} · ${playerName(result.winners[0] ?? 0)}`,
          reason: reasonText(result.reason),
        })
      : t('match.result.draw', { reason: reasonText(result.reason) });

  const go = (i: number) => {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(last, i)));
  };

  return (
    <div
      data-game={gameId}
      className="stage-screen mx-auto grid max-w-[90rem] gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-x-6 lg:py-6"
    >
      <BoardStage />
      <div className="flex flex-col gap-2 lg:col-start-2 lg:row-start-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            {t('replay.title', { game: t(`games.${gameId}.name`) })}
          </h1>
          <RulesButton gameId={gameId} config={match.config} />
        </div>
        <p className="text-sm text-[var(--muted)]">
          {t('replay.when', { date: new Date(match.startedAt).toLocaleString() })}
          {local && <> · {t('replay.savedHere')}</>}
        </p>
      </div>

      <section className="mx-auto w-full max-w-[min(100%,calc(100dvh-12rem))] lg:sticky lg:top-[4.5rem] lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:self-start">
        <Board
          view={shownView ?? definition.playerView(state, mySeat ?? 'spectator')}
          playSound={sound}
          mySeat={mySeat}
          isMyTurn={false}
          disabled
          orientation={mySeat ?? 0}
          onMove={() => {}}
          settings={{ ...DEFAULT_BOARD_SETTINGS, animations: false }}
          t={t}
        />
      </section>

      <aside className="stage-aside flex flex-col gap-3 lg:col-start-2 lg:row-start-2">
        <ul className="flex flex-col gap-2">
          {match.players.map((p) => (
            <li key={p.seat} className="card flex items-center gap-2 py-2.5">
              {PieceIcon ? <PieceIcon seat={p.seat} size={20} /> : null}
              <span className="truncate">
                {playerName(p.seat)}
                {p.seat === mySeat && !local && (
                  <span className="text-[var(--muted)]"> ({t('room.you')})</span>
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="card flex flex-col gap-3 py-3">
          <p role="status" className="font-medium" data-testid="replay-position">
            {t('replay.position', { n: index, total: last })}
          </p>
          <input
            type="range"
            min={0}
            max={last}
            value={index}
            onChange={(e) => go(Number(e.target.value))}
            aria-label={t('replay.slider')}
            className="accent-[var(--accent)]"
          />
          <div className="grid grid-cols-5 gap-1">
            <button type="button" className="btn px-2" onClick={() => go(0)} aria-label={t('replay.first')}>
              ⏮
            </button>
            <button
              type="button"
              className="btn px-2"
              onClick={() => go(index - 1)}
              aria-label={t('replay.prev')}
            >
              ◀
            </button>
            <button
              type="button"
              className="btn btn-primary px-2"
              onClick={() => {
                if (index >= last) setIndex(0);
                setPlaying((p) => !p);
              }}
              aria-label={playing ? t('replay.pause') : t('replay.play')}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <button
              type="button"
              className="btn px-2"
              onClick={() => go(index + 1)}
              aria-label={t('replay.next')}
            >
              ▶|
            </button>
            <button type="button" className="btn px-2" onClick={() => go(last)} aria-label={t('replay.last')}>
              ⏭
            </button>
          </div>
          {index === last && resultText && <p className="font-medium">{resultText}</p>}
        </div>

        <Link href="/profile" className="text-sm underline underline-offset-4">
          {t('replay.back')}
        </Link>
      </aside>
    </div>
  );
}
