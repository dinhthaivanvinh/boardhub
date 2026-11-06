'use client';

import { useEffect, useRef, useState } from 'react';
import type { OfficeDrawRecord, OfficeDrawStarted } from '@bg/protocol';
import { liXiPhaseAt, liXiPhaseKey, type LiXiPhase } from './timeline';

/**
 * Runs a Lì xì turn on server time. `onFrame` gets every animation frame (to move the light and the
 * walker straight in the DOM); React only re-renders when the step changes.
 */
export function useLiXiClock(
  draw: OfficeDrawStarted | OfficeDrawRecord | null,
  serverOffset: number,
  animate: boolean,
  onFrame?: (phase: LiXiPhase) => void,
): LiXiPhase | null {
  const [phase, setPhase] = useState(() =>
    draw ? liXiPhaseAt(draw, Date.now() + serverOffset, animate) : null,
  );
  const frame = useRef(onFrame);
  useEffect(() => {
    frame.current = onFrame;
  });

  useEffect(() => {
    if (!draw) return;
    let raf = 0;
    let last = '';
    const tick = () => {
      const p = liXiPhaseAt(draw, Date.now() + serverOffset, animate);
      const key = liXiPhaseKey(p);
      if (key !== last) {
        last = key;
        setPhase(p);
      }
      frame.current?.(p);
      if (!(p.kind === 'gift' && p.step === 'shown')) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [draw, serverOffset, animate]);

  return draw ? phase : null;
}
