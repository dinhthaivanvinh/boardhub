import { LEARN_ITEMS } from '@bg/game-chess/catalog';
import type { LearnKind } from '@bg/protocol';
import { HubError } from '../errors';
import { dayOf } from './visit-service';

/** Days of learning events kept. */
export const KEEP_LEARN_DAYS = 400;
const DAY_MS = 86_400_000;

export interface LearnEvent {
  day: string;
  /** `u:<user id>` when signed in, else `v:<random browser id>`: the two are never linked. */
  actor: string;
  userId: string | null;
  kind: LearnKind;
  itemId: string;
  at: number;
}

export interface LearnEventRepo {
  /** One event per actor, day and item: finishing the same thing again that day changes nothing. */
  record(event: LearnEvent): Promise<void>;
  /** The events of one day, oldest first. */
  listDay(day: string): Promise<LearnEvent[]>;
  /** Forget every day before `day`. */
  prune(day: string): Promise<void>;
}

export class MemoryLearnEventRepo implements LearnEventRepo {
  private readonly rows = new Map<string, LearnEvent>();

  async record(e: LearnEvent) {
    const key = [e.actor, e.day, e.kind, e.itemId].join('|');
    if (!this.rows.has(key)) this.rows.set(key, { ...e });
  }

  async listDay(day: string) {
    return [...this.rows.values()]
      .filter((e) => e.day === day)
      .sort((a, b) => a.at - b.at)
      .map((e) => ({ ...e }));
  }

  async prune(day: string) {
    for (const [key, e] of this.rows) if (e.day < day) this.rows.delete(key);
  }
}

/** Records what is finished as it happens, for the learning statistics (docs/06, learn_events). */
export class LearnEventService {
  private prunedFor = '';

  constructor(
    private readonly repo: LearnEventRepo,
    private readonly now: () => number = Date.now,
  ) {}

  async record(who: { userId: string | null; visitorId: string }, kind: LearnKind, itemId: string) {
    // Only ids that exist are stored, so nobody can fill the table with made-up text.
    if (!LEARN_ITEMS[kind].has(itemId)) throw new HubError('invalid.payload');
    const at = this.now();
    const today = dayOf(at);
    await this.repo.record({
      day: today,
      actor: who.userId ? `u:${who.userId}` : `v:${who.visitorId}`,
      userId: who.userId,
      kind,
      itemId,
      at,
    });
    if (this.prunedFor !== today) {
      this.prunedFor = today;
      await this.repo.prune(dayOf(at - KEEP_LEARN_DAYS * DAY_MS));
    }
  }
}
