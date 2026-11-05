'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { GameDefinition } from '@bg/engine';
import type { GameId } from '@/games/catalog';
import { requestBotMove } from './bot-client';
import { LocalMatch, newSeed } from './local-match';
import type { SeatController } from './match-setup';

/** Minimum time a bot "thinks", so its moves don't appear instantly (rule B7). */
export const BOT_MIN_DELAY_MS = 450;

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
  const botTurn = match.botToMove();

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
