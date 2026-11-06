'use client';

import { useEffect, useState } from 'react';
import { DRAW_LANDING_MS } from '@bg/office-core';
import type { OfficeSnapshot } from '@bg/protocol';
import { LI_XI_GIFT_MS } from './timeline';
import { liXiViewOf } from './view';

/** When the turn now playing has finished on every screen (server time), or 0 without one. */
function turnEndsAt(session: OfficeSnapshot): number {
  const d = session.draw;
  return d && d.mode === 'li-xi' ? d.revealAt + DRAW_LANDING_MS + LI_XI_GIFT_MS : 0;
}

/**
 * The host's one button: "Start" before the giving, then "Call the next person" — but only once the
 * previous envelope has finished opening, so nobody's moment is cut short.
 */
export function useLiXiControls(session: OfficeSnapshot, serverOffset: number) {
  const view = liXiViewOf(session);
  const endsAt = turnEndsAt(session);
  const [now, setNow] = useState(() => Date.now() + serverOffset);
  useEffect(() => {
    const left = endsAt - (Date.now() + serverOffset);
    if (left <= 0) return;
    const id = window.setTimeout(() => setNow(Date.now() + serverOffset), left + 50);
    return () => window.clearTimeout(id);
  }, [endsAt, serverOffset]);

  const playing = endsAt > 0 && Math.max(now, Date.now() + serverOffset) < endsAt;
  const closed = session.status === 'closed';
  const action: 'start' | 'next' | null = !view
    ? null
    : !view.started
      ? 'start'
      : view.waiting > 0
        ? 'next'
        : null;
  const can = action !== null && !closed && !playing && view !== null && view.waiting > 0;
  return { view, action, can, playing, closed };
}
