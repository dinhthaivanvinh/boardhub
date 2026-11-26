'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_BOARD_SETTINGS, type BoardSettings } from '@bg/ui';

interface AppSettings extends BoardSettings {
  /** Against the computer: point out pieces that are about to be lost (games with a coach). */
  showThreats: boolean;
  /** Read the warnings and hints aloud. */
  speakCoach: boolean;
}

interface SettingsStore extends AppSettings {
  update(patch: Partial<AppSettings>): void;
}

/** Board settings, kept in localStorage. Only used in client-only screens. */
export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_BOARD_SETTINGS,
      showThreats: true,
      speakCoach: true,
      update: (patch) => set(patch),
    }),
    {
      name: 'bg-board-settings',
      partialize: ({ showLegalMoves, animations, coordinates, confirmMove, showThreats, speakCoach }) => ({
        showLegalMoves,
        animations,
        coordinates,
        confirmMove,
        showThreats,
        speakCoach,
      }),
    },
  ),
);
