'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Seat } from '@bg/engine';
import type { BoardAssist, Coach, CoachAdvice } from '@bg/ui';

/**
 * The help of a game's coach during a match: the warning for the position on the board, and the hint once asked
 * for. A hint belongs to one position: after any move or undo it is gone.
 */
export function useCoach<V>({
  coach,
  state,
  version,
  view,
  seat,
  active,
  showWarnings,
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
}) {
  const t = useTranslations();
  const warning = useMemo(
    () => (coach && active && showWarnings ? coach.warn(view, seat) : null),
    // `view` follows `state` and `seat`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coach, state, seat, active, showWarnings],
  );
  const [asked, setAsked] = useState<{ state: unknown; version: number; advice: CoachAdvice } | null>(null);
  // A new game starts again at version 0, so the state is compared as well.
  const hint = active && asked && asked.state === state && asked.version === version ? asked.advice : null;

  const assist: BoardAssist | undefined = coach ? { warn: warning?.cells, hint: hint?.cells } : undefined;

  return {
    available: coach !== undefined,
    assist,
    messages: [warning, hint].flatMap((advice) => (advice ? [advice.text(t)] : [])),
    hintShown: hint !== null,
    askHint: () => {
      const advice = coach && active ? coach.hint(view, seat) : null;
      setAsked(advice ? { state, version, advice } : null);
    },
  };
}
