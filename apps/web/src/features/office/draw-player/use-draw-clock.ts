'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { OfficeDrawRecord, OfficeDrawStarted } from '@bg/protocol';
import { useSettings } from '@/features/settings/settings-store';
import { phaseAt, type DrawPhase } from './timeline';

const REDUCED = '(prefers-reduced-motion: reduce)';

function subscribeReduced(onChange: () => void) {
  const m = window.matchMedia(REDUCED);
  m.addEventListener('change', onChange);
  return () => m.removeEventListener('change', onChange);
}

/** Draw animations are on unless the system asks for less motion or the user turned "Animations" off. */
export function useDrawAnimations(): boolean {
  const animations = useSettings((s) => s.animations);
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
  return animations && !reduced;
}

/**
 * For party activities whose animation is the whole point (Lì xì): only the in-app "Animations" setting
 * turns them off. Many Android phones report "reduce motion" whenever battery saver is on, which would
 * otherwise leave a still room with nothing happening.
 */
export function usePartyAnimations(): boolean {
  return useSettings((s) => s.animations);
}

/** Changes only when the phase (or the countdown second) changes: that is all React needs to re-render. */
const phaseKey = (p: DrawPhase) => (p.kind === 'countdown' ? `c${Math.ceil(p.msLeft / 1000)}` : p.kind);

/**
 * Runs the draw on server time (docs/office/07 §5). `onFrame` is called on every animation frame to write
 * transforms straight into the DOM — no React state per frame — and the returned phase drives the rest.
 */
export function useDrawClock(
  draw: OfficeDrawStarted | OfficeDrawRecord,
  serverOffset: number,
  animate: boolean,
  onFrame?: (phase: DrawPhase) => void,
): DrawPhase {
  const [phase, setPhase] = useState(() => phaseAt(draw, Date.now() + serverOffset, animate));
  const frame = useRef(onFrame);
  useEffect(() => {
    frame.current = onFrame;
  });

  useEffect(() => {
    let raf = 0;
    let last = '';
    const tick = () => {
      const p = phaseAt(draw, Date.now() + serverOffset, animate);
      const key = phaseKey(p);
      if (key !== last) {
        last = key;
        setPhase(p);
      }
      frame.current?.(p);
      if (p.kind !== 'done') raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [draw, serverOffset, animate]);

  return phase;
}
