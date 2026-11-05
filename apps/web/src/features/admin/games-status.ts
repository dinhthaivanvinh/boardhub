'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { gamesStatus } from '@/online/admin-api';

interface GamesStatusState {
  /** Games an admin turned off; null until known (or when the server cannot be reached). */
  disabled: ReadonlySet<string> | null;
  loadedAt: number;
  load(): Promise<void>;
}

const FRESH_MS = 30_000;

const useGamesStatus = create<GamesStatusState>()((set, get) => ({
  disabled: null,
  loadedAt: 0,
  async load() {
    if (Date.now() - get().loadedAt < FRESH_MS) return;
    set({ loadedAt: Date.now() });
    const res = await gamesStatus();
    // Offline: assume everything is on, so local and bot games keep working (FR-PLAY-01).
    if (res.ok) set({ disabled: new Set(res.data.disabled) });
  },
}));

/** True when an admin has turned this game off (FR-CAT-03). False while unknown. */
export function useGameDisabled(gameId: string): boolean {
  const disabled = useGamesStatus((s) => s.disabled);
  useEffect(() => {
    void useGamesStatus.getState().load();
  }, []);
  return disabled?.has(gameId) ?? false;
}
