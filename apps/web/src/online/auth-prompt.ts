'use client';

import { create } from 'zustand';

interface Waiter {
  resolve(token: string): void;
  reject(err: Error): void;
}

interface AuthPromptState {
  open: boolean;
  waiters: Waiter[];
  /** Opens the "sign in, register or play as a guest" dialog; resolves with the token chosen. */
  ask(): Promise<string>;
  /** A session now exists (whichever way): everyone waiting gets its token. */
  finish(token: string): void;
  /** The dialog was closed without a choice. */
  cancel(): void;
}

export const useAuthPrompt = create<AuthPromptState>()((set, get) => ({
  open: false,
  waiters: [],
  ask: () =>
    new Promise<string>((resolve, reject) =>
      set((s) => ({ open: true, waiters: [...s.waiters, { resolve, reject }] })),
    ),
  finish(token) {
    const { waiters } = get();
    set({ open: false, waiters: [] });
    for (const w of waiters) w.resolve(token);
  },
  cancel() {
    const { waiters } = get();
    set({ open: false, waiters: [] });
    for (const w of waiters) w.reject(new Error('auth.cancelled'));
  },
}));
