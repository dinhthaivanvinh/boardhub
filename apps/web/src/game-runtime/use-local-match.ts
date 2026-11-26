'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { GameDefinition } from '@bg/engine';
import type { GameId } from '@/games/catalog';
import { requestBotMove } from './bot-client';
import { saveLocalMatch, toLocalRecord } from './local-history';
import { LocalMatch, newSeed } from './local-match';
import type { SeatController } from './match-setup';

/** Minimum time a bot "thinks" (rule B7): long enough for a young child to notice that the computer moves. */
export const BOT_MIN_DELAY_MS = 1200;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useLocalMatch<S, M, C>(
  gameId: GameId,
  def: GameDefinition<S, M, C>,
  config: unknown,
  controllers: readonly SeatController[],
) {
  const [match, setMatch] = useState(() => new LocalMatch(def, config, controllers, newSeed()));
  const snapshot = useSyncExternalStore(match.subscribe, match.getSnapshot, match.getSnapshot);
  const [error, setError] = useState<string | null>(null);
  /** The id under which the finished game was saved in this browser (for "Xem lại ván"). */
  const [savedId, setSavedId] = useState<string | null>(null);
  const botTurn = match.botToMove();

  // A finished game is kept in this browser; after an undo and a new ending it is saved again.
  const { result, moves } = snapshot;
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    saveLocalMatch(
      toLocalRecord({
        id: match.id,
        gameId,
        rulesVersion: def.meta.rulesVersion,
        config: match.config,
        seed: match.seed,
        controllers,
        moves,
        result,
        startedAt: match.startedAt,
        endedAt: Date.now(),
      }),
    )
      .then(() => !cancelled && setSavedId(match.id))
      .catch((err: unknown) => console.warn('could not save the game in this browser', err));
    return () => {
      cancelled = true;
    };
  }, [match, result, moves, gameId, def, controllers]);

  // When it is a bot's turn, ask the worker for a move. Replies for an outdated position are dropped.
  useEffect(() => {
    const turn = match.botToMove();
    if (!turn) return;
    let cancelled = false;
    const started = Date.now();
    const version = snapshot.version;
    requestBotMove({
      gameId,
      // Bots see only what their seat may see (rule B4): hidden-info games must not leak to them.
      state: def.playerView(snapshot.state, turn.seat),
      seat: turn.seat,
      level: turn.level,
      seed: snapshot.seed,
      moveIndex: snapshot.moves.length,
    })
      .then(async (move) => {
        await wait(Math.max(0, BOT_MIN_DELAY_MS - (Date.now() - started)));
        if (cancelled || match.getSnapshot().version !== version) return;
        const res = match.submit(turn.seat, move);
        if (!res.ok) console.error(`bot move rejected: ${res.code}`, move);
      })
      .catch((err: unknown) => console.error('bot failed', err));
    return () => {
      cancelled = true;
    };
  }, [match, snapshot, gameId, def]);

  const play = useCallback(
    (move: unknown) => {
      const seat = match.humanToMove();
      if (seat === null) return;
      const res = match.submit(seat, move);
      setError(res.ok ? null : res.code);
    },
    [match],
  );

  const resign = useCallback(() => {
    const seat = match.humanToMove();
    if (seat !== null) match.resign(seat);
  }, [match]);

  const undo = useCallback(() => {
    match.undo();
    setError(null);
  }, [match]);

  const newGame = useCallback(() => {
    setMatch(new LocalMatch(def, config, controllers, newSeed()));
    setError(null);
  }, [def, config, controllers]);

  return {
    snapshot,
    replayHref: result && savedId === match.id ? `/replay/local/${match.id}` : null,
    error,
    botThinking: botTurn !== null,
    humanToMove: match.humanToMove(),
    canUndo: match.canUndo(),
    play,
    undo,
    resign,
    newGame,
  };
}
