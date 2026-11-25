import type { AdminStats, VisitorKind } from '@bg/protocol';
import type { VisitRepo } from './visit-repo';

/** Vietnam has no daylight saving: a fixed +7 hours. */
const VN_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;
/** Days of history kept. */
export const KEEP_DAYS = 90;

/** The `YYYY-MM-DD` of a moment in Vietnam time. */
export const dayOf = (at: number) => new Date(at + VN_OFFSET_MS).toISOString().slice(0, 10);

/** Counts the people who used the site each day, for the admin dashboard. */
export class VisitService {
  private prunedFor = '';

  constructor(
    private readonly repo: VisitRepo,
    private readonly now: () => number = Date.now,
  ) {}

  async record(visitorId: string, kind: VisitorKind): Promise<void> {
    const today = dayOf(this.now());
    await this.repo.record(today, visitorId, kind);
    // Old days are dropped once per day and process, by the first visit.
    if (this.prunedFor !== today) {
      this.prunedFor = today;
      await this.repo.prune(dayOf(this.now() - KEEP_DAYS * DAY_MS));
    }
  }

  async stats(days: number): Promise<AdminStats> {
    const n = Math.min(Math.max(Math.floor(days) || 14, 1), KEEP_DAYS);
    const list = Array.from({ length: n }, (_, i) => dayOf(this.now() - i * DAY_MS));
    const rows = await this.repo.counts(list);
    return { today: rows[0]!, days: rows };
  }
}
