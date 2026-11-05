'use client';

import { create } from 'zustand';

/** Set when the server says this account is banned (auth.banned); the header shows why. */
export const useBanned = create<{ banned: boolean; setBanned(b: boolean): void }>()((set) => ({
  banned: false,
  setBanned: (banned) => set({ banned }),
}));
