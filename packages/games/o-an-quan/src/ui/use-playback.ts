'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OAnQuanState } from '../rules/types';
import { frameDelay, sowFrames, type Frame } from './animation';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** Playback speeds: slow, normal, fast. */
export const SPEEDS = [0.5, 1, 3] as const;
export type Speed = (typeof SPEEDS)[number];

/**
 * Shows each new move stone by stone instead of jumping to the result.
 * Moves that arrive while one is still playing (a quick reply from the computer or the opponent)
 * wait their turn, so every move is seen. Undo, reloads and jumps of more than one move are shown at once.
 */
export function usePlayback(target: OAnQuanState, enabled: boolean) {
  const [shown, setShown] = useState(target);
  const [frame, setFrame] = useState<Frame | null>(null);
  const shownRef = useRef(target);
  const lastTarget = useRef(target);
  const queue = useRef<OAnQuanState[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const [speed, setSpeedState] = useState<Speed>(1);
  const speedRef = useRef<Speed>(1);
  /** The last single move that was shown (played out or skipped), so it can be watched again. */
  const [last, setLast] = useState<{ base: OAnQuanState; next: OAnQuanState } | null>(null);

  const setSpeed = useCallback((s: Speed) => {
    speedRef.current = s;
    setSpeedState(s);
  }, []);

  const show = useCallback((s: OAnQuanState) => {
    shownRef.current = s;
    setShown(s);
    setFrame(null);
  }, []);

  /** Plays the sowing from `base` to `next`, then calls `done`. The speed can change while it runs. */
  const animate = useCallback(
    (base: OAnQuanState, next: OAnQuanState, done: () => void) => {
      const frames = sowFrames(base, next.lastMove!);
      busy.current = true;
      let i = 0;
      const tick = () => {
        const f = frames[i++];
        if (f) {
          setFrame(f);
          timer.current = setTimeout(tick, frameDelay(f, frames.length) / speedRef.current);
          return;
        }
        busy.current = false;
        show(next);
        done();
      };
      tick();
    },
    [show],
  );

  const pump = useCallback(() => {
    while (!busy.current && queue.current.length > 0) {
      const next = queue.current.shift()!;
      const base = shownRef.current;
      const single = next.lastMove !== null && next.moveCount === base.moveCount + 1 && !base.ended;
      setLast(single ? { base, next } : null);
      if (!single || !enabledRef.current || prefersReducedMotion()) {
        show(next);
        continue;
      }
      animate(base, next, pump);
    }
  }, [show, animate]);

  useEffect(() => {
    if (target === lastTarget.current) return;
    lastTarget.current = target;
    queue.current.push(target);
    pump();
  }, [target, pump]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /** Jump to the latest position. */
  const skip = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    busy.current = false;
    queue.current = [];
    show(lastTarget.current);
  }, [show]);

  /** Plays the last move again, stone by stone (also after it was skipped). */
  const replay = useCallback(() => {
    if (busy.current || !last || shownRef.current !== last.next) return;
    show(last.base);
    animate(last.base, last.next, pump);
  }, [last, show, animate, pump]);

  const playing = frame !== null;
  return {
    shown,
    frame,
    playing,
    skip,
    speed,
    setSpeed,
    replay,
    canReplay: !playing && last !== null && shown === last.next,
  };
}
