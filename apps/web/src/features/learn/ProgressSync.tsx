'use client';

import { useEffect } from 'react';
import { useSession } from '@/online/session';
import { onProgressChange } from './use-progress';
import { syncProgress } from './progress-sync';

/** Wait this long after the last change before saving, so a burst of answers is one request. */
const SAVE_DELAY_MS = 1500;

/**
 * Keeps the learning progress of a signed-in child on the account: once when the page opens with a session
 * (or right after signing in), then a little after every change. Renders nothing; a failed save (offline) is
 * simply tried again at the next change or the next visit.
 */
export function ProgressSync() {
  const token = useSession((s) => s.token);

  useEffect(() => {
    if (!token) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void syncProgress(token);
    const off = onProgressChange(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void syncProgress(token), SAVE_DELAY_MS);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [token]);

  return null;
}
