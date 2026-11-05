'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { MoveSounds, MusicMood, SoundCue } from '@bg/ui';
import { whenAudio } from './engine';
import { startMusic } from './music';
import { playSound, syncVolumes } from './play';
import { useSoundSettings } from './settings';

export type Outcome = 'win' | 'loss' | 'draw' | 'neutral';

const moveCountOf = (view: unknown) =>
  typeof view === 'object' && view !== null && typeof (view as { moveCount?: unknown }).moveCount === 'number'
    ? (view as { moveCount: number }).moveCount
    : null;

export const playCue = (cue: SoundCue) => playSound(cue.kind, cue.delay ?? 0, cue.count ?? 1);

/**
 * Sound for one match screen (docs/08 §10):
 * - each single new move: the game's MoveSounds (jumps such as undo, resync or a reload stay silent)
 * - the end: a win, loss or draw jingle, from the viewer's side
 * - quiet background music while the match is on (`music`), fading out at the end
 * Returns `playSound` for boards that time their own sounds (BoardProps.playSound).
 */
export function useGameSound<V>(o: {
  view: V;
  moveSounds: MoveSounds<V> | undefined;
  /** null when there is no music on this screen (e.g. replays). */
  music: MusicMood | null;
  /** The match is over (with the outcome for the viewer), or null while it is on. */
  outcome: Outcome | null;
}): (cue: SoundCue) => void {
  const { view, moveSounds, music, outcome } = o;
  const prev = useRef(view);

  useEffect(() => {
    const before = prev.current;
    prev.current = view;
    if (before === view || !moveSounds) return;
    const a = moveCountOf(before);
    const b = moveCountOf(view);
    if (a === null || b !== a + 1) return;
    for (const cue of moveSounds(before, view)) playCue(cue);
  }, [view, moveSounds]);

  // The jingle only when the result appears while watching (not when opening a finished match).
  const shownOutcome = useRef(outcome);
  useEffect(() => {
    const before = shownOutcome.current;
    shownOutcome.current = outcome;
    if (before !== null || outcome === null) return;
    // After the last move's own sound.
    playSound(outcome === 'loss' ? 'lose' : outcome === 'draw' ? 'draw' : 'win', 450);
  }, [outcome]);

  const musicOn = useSoundSettings((s) => s.music);
  const playing = music !== null && outcome === null && musicOn;
  useEffect(() => {
    if (!playing || !music) return;
    let stop: ((fade?: number) => void) | null = null;
    const cancel = whenAudio((g) => {
      syncVolumes();
      stop = startMusic(g, music);
    });
    return () => {
      cancel();
      stop?.(2);
    };
  }, [playing, music]);

  return useCallback((cue: SoundCue) => playCue(cue), []);
}
