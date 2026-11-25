'use client';

import { useEffect } from 'react';
import { apiRequest } from '@/online/api';
import { useSession } from '@/online/session';

const ID_KEY = 'bh.visitor.v1';
const SENT_KEY = 'bh.visit.sent.v1';

/** The day in Vietnam time, as the server counts it. */
const today = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

function visitorId(): string {
  let id = window.localStorage.getItem(ID_KEY);
  if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
    id = crypto.randomUUID();
    window.localStorage.setItem(ID_KEY, id);
  }
  return id;
}

/**
 * Tells the server once a day that this browser came, for the visitor count of the admin page. It sends a random
 * id the browser made up (no cookie, no address, no name) and, when someone is signed in, their token so the
 * server can tell guests and accounts from people who are not signed in. A failed ping is tried again at the
 * next page load. Renders nothing.
 */
export function VisitPing() {
  const token = useSession((s) => s.token);
  const kind = useSession((s) => s.user?.kind);

  useEffect(() => {
    try {
      // Sent again the same day only when the visitor signs in, because that changes what they count as.
      const mark = `${today()}:${token ? (kind ?? 'guest') : 'anonymous'}`;
      if (window.localStorage.getItem(SENT_KEY) === mark) return;
      void apiRequest('POST', '/api/visit', { visitorId: visitorId() }, token).then((res) => {
        if (!res.ok) return;
        try {
          window.localStorage.setItem(SENT_KEY, mark);
        } catch {
          /* not remembered: the next page load sends it again */
        }
      });
    } catch {
      /* storage blocked: no count, nothing else */
    }
  }, [token, kind]);

  return null;
}
