'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OAnQuanState } from '../rules/types';
import { frameDelay, sowFrames, type Frame } from './animation';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

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

  const show = useCallback((s: OAnQuanState) => {
    shownRef.current = s;
    setShown(s);
    setFrame(null);
  }, []);

  const pump = useCallback(() => {
    while (!busy.current && queue.current.length > 0) {
      const next = queue.current.shift()!;
      const base = shownRef.current;
      const animate =
        enabledRef.current &&
        !prefersReducedMotion() &&
        next.lastMove !== null &&
        next.moveCount === base.moveCount + 1 &&
        !base.ended;
      if (!animate) {
        show(next);
        continue;
      }
      const frames = sowFrames(base, next.lastMove!);
      busy.current = true;
      let i = 0;
      const tick = () => {
        const f = frames[i++];
        if (f) {
          setFrame(f);
          timer.current = setTimeout(tick, frameDelay(f, frames.length));
          return;
        }
        busy.current = false;
        show(next);
        pump();
      };
      tick();
    }
  }, [show]);

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

  return { shown, frame, playing: frame !== null, skip };
}
