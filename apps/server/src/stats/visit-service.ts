import {
  addDays,
  daysOf,
  previousRange,
  type AdminStats,
  type DateRange,
  type VisitorKind,
  type VisitorList,
} from '@bg/protocol';
import type { UserRepo } from '../store/repos';
import type { VisitRepo } from './visit-repo';

/** Vietnam has no daylight saving: a fixed +7 hours. */
const VN_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;
/** Days of history kept. */
export const KEEP_DAYS = 90;

/** The `YYYY-MM-DD` of a moment in Vietnam time. */
export const dayOf = (at: number) => new Date(at + VN_OFFSET_MS).toISOString().slice(0, 10);

/** The most accounts the list of visitors holds. */
export const VISITOR_LIST_LIMIT = 500;

/** Counts the people who used the site each day, for the admin dashboard. */
export class VisitService {
  private prunedFor = '';

  constructor(
    private readonly repo: VisitRepo,
    private readonly now: () => number = Date.now,
  ) {}

  /** `userId` is the signed-in account, kept apart from the browser id (see AccountVisitsTable). */
  async record(
    visitorId: string,
    kind: VisitorKind,
    newSession = false,
    userId: string | null = null,
  ): Promise<void> {
    const today = dayOf(this.now());
    await this.repo.record(today, visitorId, kind, newSession);
    if (userId) await this.repo.recordAccount(today, userId);
    // Old days are dropped once per day and process, by the first visit.
    if (this.prunedFor !== today) {
      this.prunedFor = today;
      await this.repo.prune(dayOf(this.now() - KEEP_DAYS * DAY_MS));
    }
  }

  /** Who is behind the numbers of a range: the accounts by name, and how many browsers there were. */
  async who(range: DateRange, users: UserRepo, limit = VISITOR_LIST_LIMIT): Promise<VisitorList> {
    const [rows, browsers, since] = await Promise.all([
      // one more than shown, to know whether the list was cut
      this.repo.accounts(range.from, range.to, limit + 1),
      this.repo.totals(range.from, range.to),
      this.repo.accountsSince(),
    ]);
    const shown = rows.slice(0, limit);
    const found = new Map((await users.findManyByIds(shown.map((r) => r.userId))).map((u) => [u.id, u]));
    return {
      range,
      accounts: shown.flatMap(({ userId, days, lastDay }) => {
        const user = found.get(userId);
        if (!user) return [];
        return [{ id: userId, name: user.displayName, email: user.email, kind: user.kind, days, lastDay }];
      }),
      truncated: rows.length > limit,
      browsers,
      since,
    };
  }

  /** The last `days` days, ending today. */
  lastDays(days: number): DateRange {
    const n = Math.min(Math.max(Math.floor(days) || 14, 1), KEEP_DAYS);
    const to = dayOf(this.now());
    return { from: addDays(to, 1 - n), to };
  }

  async stats(range: DateRange): Promise<AdminStats> {
    const today = dayOf(this.now());
    const before = previousRange(range);
    const since = await this.repo.since();
    // Older days are deleted: comparing with a range that is partly gone would show a false rise.
    const kept = dayOf(this.now() - KEEP_DAYS * DAY_MS);
    const comparable = since !== null && before.from >= since && before.from >= kept;
    const [[now], days, unique, previous] = await Promise.all([
      this.repo.counts([today]),
      this.repo.counts(daysOf(range).reverse()),
      this.repo.totals(range.from, range.to),
      comparable ? this.repo.totals(before.from, before.to) : null,
    ]);
    return { today: now!, days, range, unique, previous, since };
  }
}
