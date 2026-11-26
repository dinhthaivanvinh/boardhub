'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { apiRequest } from '@/online/api';
import { useSession } from '@/online/session';
import { touchSession, visitorId } from './visitor';

const SENT_KEY = 'bh.visit.sent.v1';
/** While the child is using a page, "still here" is written at most this often. */
const TOUCH_EVERY_MS = 60_000;

/** The day in Vietnam time, as the server counts it. */
const today = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/**
 * Tells the server that this browser came, for the visitor count of the admin page: once a day, again when
 * someone signs in, and once for every new session (back after 30 minutes away). It sends a random id the
 * browser made up (no cookie, no address, no name). When someone is signed in it also sends their token: the
 * server can then tell guests and accounts from people who are not signed in, and notes, apart from that id,
 * that the account visited. A failed ping is tried again at the next
 * page. Renders nothing.
 */
export function VisitPing() {
  const token = useSession((s) => s.token);
  const kind = useSession((s) => s.user?.kind);
  const userId = useSession((s) => s.user?.id);
  const pathname = usePathname();
  const newSession = useRef(false);
  const touched = useRef(0);

  const touch = useCallback(() => {
    const now = Date.now();
    touched.current = now;
    if (touchSession(now)) newSession.current = true;
  }, []);

  const send = useCallback(() => {
    try {
      touch();
      const mark = `${today()}:${token ? `${kind ?? 'guest'}:${userId ?? ''}` : 'anonymous'}`;
      const starting = newSession.current;
      if (!starting && window.localStorage.getItem(SENT_KEY) === mark) return;
      newSession.current = false;
      void apiRequest('POST', '/api/visit', { visitorId: visitorId(), newSession: starting }, token).then(
        (res) => {
          if (!res.ok) {
            newSession.current ||= starting;
            return;
          }
          try {
            window.localStorage.setItem(SENT_KEY, mark);
          } catch {
            /* not remembered: the next page sends it again */
          }
        },
      );
    } catch {
      /* storage blocked: no count, nothing else */
    }
  }, [token, kind, userId, touch]);

  // On the first page, on every page after it, and after signing in.
  useEffect(() => {
    send();
  }, [send, pathname]);

  useEffect(() => {
    // Coming back to the tab may be a new session.
    const onVisible = () => {
      if (document.visibilityState === 'visible') send();
    };
    // A long lesson on one page is one session: using the page keeps it going.
    const onUse = () => {
      if (Date.now() - touched.current >= TOUCH_EVERY_MS) send();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pointerdown', onUse);
    window.addEventListener('keydown', onUse);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pointerdown', onUse);
      window.removeEventListener('keydown', onUse);
    };
  }, [send]);

  return null;
}
