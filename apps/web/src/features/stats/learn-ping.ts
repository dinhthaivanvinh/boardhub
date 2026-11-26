import { LEARN_ITEMS } from '@bg/game-chess';
import type { LearnKind } from '@bg/protocol';
import { apiRequest } from '@/online/api';
import { useSession } from '@/online/session';
import { visitorId } from './visitor';

export const doneKind = (id: string): LearnKind => (LEARN_ITEMS.practice.has(id) ? 'practice' : 'lesson');

/**
 * Tells the server that something was just finished, for the learning statistics: the id of the lesson or
 * puzzle, with the account when signed in and the browser's random id otherwise. Best effort: offline or with
 * storage blocked nothing is sent, and the child's progress is not affected.
 */
export function sendLearnEvent(kind: LearnKind, itemId: string): void {
  try {
    void apiRequest(
      'POST',
      '/api/learn-events',
      { visitorId: visitorId(), kind, itemId },
      useSession.getState().token,
    );
  } catch {
    /* not counted */
  }
}
