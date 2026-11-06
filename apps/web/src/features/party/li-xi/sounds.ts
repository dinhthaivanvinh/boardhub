'use client';

import { useEffect, useRef } from 'react';
import {
  duckMusic,
  playFirecrackers,
  playFireworks,
  playGong,
  playRustle,
  playShake,
  playTing,
  startLionDrums,
  startTetMusic,
} from './tet-audio';
import { liXiPhaseKey, type LiXiPhase } from './timeline';

/**
 * The sounds of a turn, played only on steps this screen sees happen (opening the page on a finished
 * turn stays quiet): drums while the light looks, a gong when it stops, paper and a "ting" with
 * firecrackers when the envelope opens, fireworks for the biggest note.
 */
export function useLiXiSounds(
  drawId: string | null,
  phase: LiXiPhase | null,
  on: boolean,
  top: number,
  value: number | null,
) {
  const key = phase ? liXiPhaseKey(phase).replace(/^c\d+$/, 'countdown') : 'idle';
  const seen = useRef({ drawId, key });
  const roll = useRef<(() => void) | null>(null);

  useEffect(() => {
    const before = seen.current;
    seen.current = { drawId, key };
    const fresh = before.drawId === drawId && before.key !== key;
    const stopRoll = () => {
      roll.current?.();
      roll.current = null;
    };
    if (!on) {
      stopRoll();
      return;
    }
    if (key === 'buildUp' && !roll.current) {
      roll.current = startLionDrums();
      duckMusic(true);
    }
    if (key !== 'buildUp' && key !== 'landing' && roll.current) stopRoll();
    if (!fresh) return;
    switch (key) {
      case 'walk':
        playGong();
        break;
      case 'shake':
        playShake();
        break;
      case 'open':
        playRustle();
        break;
      case 'note':
        playTing();
        playFirecrackers();
        if (value !== null && value > 0 && value === top) playFireworks();
        break;
      case 'shown':
        duckMusic(false);
        break;
    }
  }, [drawId, key, on, top, value]);

  useEffect(
    () => () => {
      roll.current?.();
      duckMusic(false);
    },
    [],
  );
}

/** The Tết tune while the stage is open and the sound is on. */
export function useTetMusic(on: boolean) {
  useEffect(() => {
    if (!on) return;
    return startTetMusic();
  }, [on]);
}
