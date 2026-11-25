import type { DayVisits, VisitorKind } from '@bg/protocol';

const RANK: Record<VisitorKind, number> = { anonymous: 0, guest: 1, registered: 2 };

/** Distinct visitors per day. A visitor is stored once a day, as the highest kind they had that day. */
export interface VisitRepo {
  record(day: string, visitorId: string, kind: VisitorKind): Promise<void>;
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
});

export class MemoryVisitRepo implements VisitRepo {
  private readonly rows = new Map<string, Map<string, VisitorKind>>();

  async record(day: string, visitorId: string, kind: VisitorKind) {
    const visitors = this.rows.get(day) ?? new Map<string, VisitorKind>();
    const old = visitors.get(visitorId);
    if (old === undefined || RANK[kind] > RANK[old]) visitors.set(visitorId, kind);
    this.rows.set(day, visitors);
  }

  async counts(days: string[]) {
    return days.map((day) => {
      const out = emptyDay(day);
      for (const kind of this.rows.get(day)?.values() ?? []) {
        out[kind]++;
        out.total++;
      }
      return out;
    });
  }

  async prune(day: string) {
    for (const d of [...this.rows.keys()]) if (d < day) this.rows.delete(d);
  }
}
