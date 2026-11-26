import type { DayVisits, VisitorKind } from '@bg/protocol';

const RANK: Record<VisitorKind, number> = { anonymous: 0, guest: 1, registered: 2 };

/** Distinct visitors per day. A visitor is stored once a day, as the highest kind they had that day. */
export interface VisitRepo {
  /** `newSession` adds one session to a visitor already counted that day; the first record is one session. */
  record(day: string, visitorId: string, kind: VisitorKind, newSession?: boolean): Promise<void>;
  /** One row per given day, in the same order, zeros for a day nobody came. */
  counts(days: string[]): Promise<DayVisits[]>;
  /** Forget every day before `day`. */
  prune(day: string): Promise<void>;
}

export const emptyDay = (day: string): DayVisits => ({
  day,
  anonymous: 0,
  guest: 0,
  registered: 0,
  total: 0,
  sessions: 0,
});

export class MemoryVisitRepo implements VisitRepo {
  private readonly rows = new Map<string, Map<string, { kind: VisitorKind; sessions: number }>>();

  async record(day: string, visitorId: string, kind: VisitorKind, newSession = false) {
    const visitors = this.rows.get(day) ?? new Map<string, { kind: VisitorKind; sessions: number }>();
    const old = visitors.get(visitorId);
    visitors.set(visitorId, {
      kind: old && RANK[old.kind] >= RANK[kind] ? old.kind : kind,
      sessions: old ? old.sessions + (newSession ? 1 : 0) : 1,
    });
    this.rows.set(day, visitors);
  }

  async counts(days: string[]) {
    return days.map((day) => {
      const out = emptyDay(day);
      for (const { kind, sessions } of this.rows.get(day)?.values() ?? []) {
        out[kind]++;
        out.total++;
        out.sessions += sessions;
      }
      return out;
    });
  }

  async prune(day: string) {
    for (const d of [...this.rows.keys()]) if (d < day) this.rows.delete(d);
  }
}
