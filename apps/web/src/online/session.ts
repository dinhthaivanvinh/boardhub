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

/** Who the player is on the game server. Kept in localStorage; a guest account is created on demand. */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: ({ token, user }) => set({ token, user }),
      setUser: (user) => set({ user }),
      clear: () => set({ token: null, user: null }),
    }),
    { name: 'bg-session', partialize: ({ token, user }) => ({ token, user }) },
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
