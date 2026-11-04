'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_BOARD_SETTINGS, type BoardSettings } from '@bg/ui';

interface SettingsStore extends BoardSettings {
  update(patch: Partial<BoardSettings>): void;
}

/** Board settings, kept in localStorage. Only used in client-only screens. */
export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_BOARD_SETTINGS,
      update: (patch) => set(patch),
    }),
    {
      name: 'bg-board-settings',
      partialize: ({ showLegalMoves, animations, coordinates, confirmMove }) => ({
        showLegalMoves,
        animations,
        coordinates,
        confirmMove,
      }),
    },
  ),
);
