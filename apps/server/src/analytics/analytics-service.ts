import {
  daysOf,
  previousRange,
  vnDayStart,
  addDays,
  type AdminActivity,
  type AdminOverview,
  type DateRange,
  type OverviewDay,
} from '@bg/protocol';
import { LEARN_ITEMS } from '@bg/game-chess/catalog';
import type { UserRepo } from '../store/repos';
import { noCounts, type AnalyticsRepo, type KindCounts, type RawActivity } from './analytics-repo';

/** Entries of "recent activity" on the dashboard. */
export const RECENT_LIMIT = 15;

/** The moments a range of Vietnam days covers: start included, end excluded. */
const moments = (r: DateRange) => [vnDayStart(r.from), vnDayStart(addDays(r.to, 1))] as const;

/** Builds the admin dashboard from real stored data. */
export class AnalyticsService {
  constructor(
    private readonly repo: AnalyticsRepo,
    private readonly users: UserRepo,
  ) {}

  async overview(range: DateRange): Promise<AdminOverview> {
    const before = previousRange(range);
    const [from, to] = moments(range);
    const [prevFrom, prevTo] = moments(before);
    const [
      atStart,
      added,
      addedBefore,
      chessAtStart,
      chessDays,
      chessBefore,
      learnDays,
      learned,
      learnedBefore,
      since,
      saved,
      lessons,
      recent,
    ] = await Promise.all([
      this.repo.accountsBefore(from),
      this.repo.newAccounts(from, to),
      this.repo.newAccounts(prevFrom, prevTo),
      this.repo.matchesBefore('chess', from),
      this.repo.matchesByDay('chess', from, to),
      this.repo.matchesByDay('chess', prevFrom, prevTo),
      this.repo.learnByDay(range.from, range.to),
      this.repo.learnTotals(range.from, range.to),
      this.repo.learnTotals(before.from, before.to),
      this.repo.learningSince(),
      this.repo.savedProgress([...LEARN_ITEMS.lesson], [...LEARN_ITEMS.puzzle]),
      this.repo.lessonLearners(range.from, range.to),
      this.repo.recent(RECENT_LIMIT),
    ]);

    const running: KindCounts = { ...atStart };
    let chessTotal = chessAtStart;
    const days: OverviewDay[] = daysOf(range).map((day) => {
      for (const row of added) if (row.day === day) running[row.kind] += row.n;
      const chessGames = chessDays.find((r) => r.day === day)?.n ?? 0;
      chessTotal += chessGames;
      // A day before collecting started is unknown, not zero.
      const known = since !== null && day >= since;
      const row = learnDays.find((r) => r.day === day);
      return {
        day,
        registered: running.registered,
        guest: running.guest,
        chessGames,
        learners: known ? (row?.learners ?? 0) : null,
        lesson: known ? (row?.lesson ?? 0) : null,
        practice: known ? (row?.practice ?? 0) : null,
        puzzle: known ? (row?.puzzle ?? 0) : null,
      };
    });

    const sum = (rows: { n: number; kind?: keyof KindCounts }[]) => {
      const out = noCounts();
      for (const r of rows) if (r.kind) out[r.kind] += r.n;
      return out;
    };
    const now = sum(added);
    const past = sum(addedBefore);
    const account = (kinds: (keyof KindCounts)[]) => {
      const of = (c: KindCounts) => kinds.reduce((n, k) => n + c[k], 0);
      return { total: of(running), added: { value: of(now), previous: of(past) } };
    };
    // The range before can only be compared when learning was being recorded for all of it.
    const comparable = since !== null && before.from >= since;
    const compared = (value: number, previous: number) => ({ value, previous: comparable ? previous : null });
    const total = (rows: { n: number }[]) => rows.reduce((n, r) => n + r.n, 0);

    return {
      range,
      accounts: {
        all: account(['guest', 'registered']),
        registered: account(['registered']),
        guest: account(['guest']),
      },
      learners: compared(learned.learners, learnedBefore.learners),
      lessonsTotal: LEARN_ITEMS.lesson.size,
      completedLessons: { ...compared(learned.lesson, learnedBefore.lesson), saved: saved.lessons },
      solvedPuzzles: { ...compared(learned.puzzle, learnedBefore.puzzle), saved: saved.puzzles },
      chess: { total: chessTotal, started: { value: total(chessDays), previous: total(chessBefore) } },
      learningSince: since,
      days,
      lessons: [...lessons].sort((a, b) => b.learners - a.learners || a.itemId.localeCompare(b.itemId)),
      recent: await this.named(recent),
    };
  }

  /** Puts display names on the accounts; a bot seat and a child who is not signed in stay null. */
  private async named(rows: RawActivity[]): Promise<AdminActivity[]> {
    const ids = rows.flatMap((r) => {
      if (r.type === 'match') return r.players.filter((id): id is string => id !== null);
      const id = r.type === 'report' ? r.targetId : r.userId;
      return id ? [id] : [];
    });
    const users = await this.users.findManyByIds([...new Set(ids)]);
    const names = new Map(users.map((u) => [u.id, u.displayName]));
    const name = (id: string) => names.get(id) ?? '?';
    return rows.map((r): AdminActivity => {
      switch (r.type) {
        case 'signup':
          return { type: r.type, at: r.at, kind: r.kind, name: name(r.userId) };
        case 'match':
          return { ...r, players: r.players.map((id) => (id === null ? null : name(id))) };
        case 'report':
          return { type: r.type, at: r.at, reason: r.reason, name: name(r.targetId) };
        case 'learn':
          return {
            type: r.type,
            at: r.at,
            kind: r.kind,
            itemId: r.itemId,
            name: r.userId === null ? null : name(r.userId),
          };
      }
    });
  }
}
