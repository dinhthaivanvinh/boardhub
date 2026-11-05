'use client';

import { audio, installUnlock, setVolumes } from './engine';
import { useSoundSettings } from './settings';
import { synth, type AppSound } from './synth';

/** Bus levels: music stays well under the effects even at full volume. */
const EFFECTS_LEVEL = 0.9;
const MUSIC_LEVEL = 0.4;

/** Applies the saved volumes to the audio graph (and keeps doing so when they change). */
export function syncVolumes(): void {
  const s = useSoundSettings.getState();
  setVolumes(s.effects ? s.effectsVolume * EFFECTS_LEVEL : 0, s.music ? s.musicVolume * MUSIC_LEVEL : 0);
}
if (typeof window !== 'undefined') useSoundSettings.subscribe(syncVolumes);

declare global {
  interface Window {
    /** Sounds played, for tests (only when localStorage "bg-sound-debug" is "1"). */
    __bgSounds?: string[];
  }
}

const debug = () => {
  try {
    return localStorage.getItem('bg-sound-debug') === '1';
  } catch {
    return false;
  }
};

/** Plays an effect if effects are on and sound is allowed yet; otherwise does nothing. */
export function playSound(sound: AppSound, delayMs = 0, count = 1): void {
  if (typeof window === 'undefined' || !useSoundSettings.getState().effects) return;
  installUnlock();
  if (debug()) (window.__bgSounds ??= []).push(count > 1 ? `${sound}×${count}` : sound);
  const g = audio();
  if (!g) return;
  syncVolumes();
  synth(g, sound, delayMs / 1000, count);
}
