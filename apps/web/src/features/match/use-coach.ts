'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Seat } from '@bg/engine';
import type { BoardAssist, Coach, CoachAdvice } from '@bg/ui';

/** Hints a player gets in one game. */
export const HINT_LIMIT = 3;

/**
 * The help of a game's coach during a match: the warning for the position on the board, and the hint once asked
 * for. A hint belongs to one position: after any move or undo it is gone, and taking a move back does not give
 * the hint back. A new game does.
 */
export function useCoach<V>({
  coach,
  state,
  version,
  view,
  seat,
  active,
  showWarnings,
  speak,
  gameKey,
}: {
  coach: Coach<V> | undefined;
  /** Changes exactly when the position does (the view is a new object on every render). */
  state: unknown;
  version: number;
  view: V;
  seat: Seat;
  /** Whether it is the player's turn. */
  active: boolean;
  showWarnings: boolean;
  /** Read warnings and hints aloud. */
  speak: boolean;
  /** Changes with every new game. */
  gameKey: string;
}) {
  const t = useTranslations();
  const lang = useLocale();
  const warning = useMemo(
    () => (coach && active && showWarnings ? coach.warn(view, seat) : null),
    // `view` follows `state` and `seat`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coach, state, seat, active, showWarnings],
  );
  const [asked, setAsked] = useState<{ state: unknown; version: number; advice: CoachAdvice } | null>(null);
  const [used, setUsed] = useState({ gameKey, count: 0 });
  const count = used.gameKey === gameKey ? used.count : 0;
  // A new game starts again at version 0, so the state is compared as well.
  const hint = active && asked && asked.state === state && asked.version === version ? asked.advice : null;
  const isLast = hint !== null && count >= HINT_LIMIT;

  /** What is said for a hint: the last one of the game says so. */
  const hintSpeech = (advice: CoachAdvice, last: boolean) =>
    coach ? [...advice.speech(t), ...(last ? [coach.lastHint(t)] : [])] : [];

  const voice = coach?.voice;
  useEffect(() => {
    if (!voice) return;
    voice.prepare(lang);
    return () => voice.stop();
  }, [voice, lang]);
  useEffect(() => {
    if (!speak) voice?.stop();
  }, [voice, speak]);

  // A warning is read when the pieces in danger change, not again at every turn they stay there.
  const said = useRef('');
  const warningText = warning?.text(t) ?? '';
  useEffect(() => {
    said.current = '';
  }, [gameKey]);
  useEffect(() => {
    // While the computer moves there is no warning; that does not make the next one new.
    if (!active) return;
    const key = warningText;
    if (key === said.current) return;
    said.current = key;
    if (speak && warning) voice?.say(warning.speech(t), lang);
    // The words stand for the warning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, warningText, speak]);

  const assist: BoardAssist | undefined = coach ? { warn: warning?.cells, hint: hint?.cells } : undefined;
  const messages = [
    ...(warning ? [warningText] : []),
    ...(hint ? [hint.text(t)] : []),
    ...(isLast && coach ? [coach.lastHint(t)] : []),
  ];
  // "Hear it again" repeats the hint if one is shown, else the warning.
  const again = hint ? hintSpeech(hint, isLast) : (warning?.speech(t) ?? null);

  return {
    available: coach !== undefined,
    assist,
    messages,
    hintShown: hint !== null,
    hintsLeft: Math.max(0, HINT_LIMIT - count),
    sayAgain: speak && voice && again ? () => voice.say(again, lang) : null,
    askHint: () => {
      if (!coach || !active || count >= HINT_LIMIT) return;
      const advice = coach.hint(view, seat);
      if (!advice) return;
      setAsked({ state, version, advice });
      setUsed({ gameKey, count: count + 1 });
      if (speak) coach.voice.say(hintSpeech(advice, count + 1 >= HINT_LIMIT), lang);
    },
  };
}
