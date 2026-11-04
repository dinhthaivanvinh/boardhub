'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** False during server render and hydration, true afterwards. Use before reading localStorage-backed state. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
