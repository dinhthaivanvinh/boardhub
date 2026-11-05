'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResponse, PublicUser } from '@bg/protocol';
import { apiRequest } from './api';

interface SessionState {
  token: string | null;
  user: PublicUser | null;
  setAuth(auth: AuthResponse): void;
  setUser(user: PublicUser): void;
  clear(): void;
}

const SESSION_STORAGE_KEY = 'bg-session';

/**
 * Who the player is on the game server. Kept in localStorage, so every tab of a browser is the same
 * person (an invite link opened in a new tab keeps your seat). A guest account is created on demand.
 */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: ({ token, user }) => set({ token, user }),
      setUser: (user) => set({ user }),
      clear: () => set({ token: null, user: null }),
    }),
    { name: SESSION_STORAGE_KEY, partialize: ({ token, user }) => ({ token, user }) },
  ),
);

let pendingGuest: Promise<string> | null = null;

/** Returns the current token, creating a guest account first if there is none (FR-AUTH-01). */
export function ensureToken(): Promise<string> {
  const { token } = useSession.getState();
  if (token) return Promise.resolve(token);
  pendingGuest ??= apiRequest<AuthResponse>('POST', '/api/auth/guest', {})
    .then((res) => {
      if (!res.ok) throw new Error(res.code);
      useSession.getState().setAuth(res.data);
      return res.data.token;
    })
    .finally(() => {
      pendingGuest = null;
    });
  return pendingGuest;
}

/**
 * Switches this browser to a brand-new guest (to try several players on one machine).
 * The old guest cannot be recovered unless it was registered. Other tabs follow (see below).
 */
export async function startNewGuest(): Promise<string> {
  // Swap in one write, so other tabs never see a moment with no session (they would make their own guest).
  const res = await apiRequest<AuthResponse>('POST', '/api/auth/guest', {});
  if (!res.ok) throw new Error(res.code);
  useSession.getState().setAuth(res.data);
  return res.data.token;
}

// One identity per browser: when another tab signs in, signs out or starts a new guest, reload this
// tab so it never keeps talking to the server as someone else.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== SESSION_STORAGE_KEY) return;
    const before = useSession.getState().user?.id ?? null;
    void Promise.resolve(useSession.persist.rehydrate()).then(() => {
      const after = useSession.getState().user?.id ?? null;
      if (after !== before) window.location.reload();
    });
  });
}
