'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SoundSettings {
  /** Move, capture, win/lose sounds. */
  effects: boolean;
  effectsVolume: number;
  /** Quiet background music during a game. */
  music: boolean;
  musicVolume: number;
}

export const DEFAULT_SOUND: SoundSettings = {
  effects: true,
  effectsVolume: 0.7,
  music: true,
  musicVolume: 0.5,
};

/** Sound choices, kept on this device (docs/08 §10). */
export const useSoundSettings = create<SoundSettings & { update(patch: Partial<SoundSettings>): void }>()(
  persist(
    (set) => ({
      ...DEFAULT_SOUND,
      update: (patch) => set(patch),
    }),
    {
      name: 'bg-sound',
      partialize: ({ effects, effectsVolume, music, musicVolume }) => ({
        effects,
        effectsVolume,
        music,
        musicVolume,
      }),
    },
  ),
);
