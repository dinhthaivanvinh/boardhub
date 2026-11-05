import type { Redis } from 'ioredis';
import type { OfficeDrawRecord, OfficeDrawStarted, OfficeParticipant, OfficeStatus } from '@bg/protocol';

/** A live office session (docs/office/06 §5). Stored whole: at most 200 participants (~60 KB). */
export interface OfficeSessionRecord {
  code: string;
  activityId: string;
  title: string;
  hostId: string;
  status: OfficeStatus;
  createdAt: number;
  lastActiveAt: number;
  /** Increases with every change other screens need to see. */
  seq: number;
  participants: OfficeParticipant[];
  /** Kicked users cannot come back. */
  kicked: string[];
  /** The activity's state (JSON). */
  state: unknown;
  /** The current or last draw. Seed and winners stay on the server until the reveal (ADR-0006). */
  draw?: RunningDraw | null;
  /** Revealed draws, newest first (at most 50). */
  history?: OfficeDrawRecord[];
}

export interface RunningDraw extends OfficeDrawStarted {
  seed: string;
  winners: string[];
  /** Prize of each winner, when the activity asked for prizes; secret until the reveal like winners. */
  awarded?: string[];
  revealed: boolean;
  revealedAt: number | null;
}

export interface OfficeStore {
  get(code: string): Promise<OfficeSessionRecord | null>;
  save(session: OfficeSessionRecord): Promise<void>;
}

/** Closed sessions stay readable a little longer than the 24 h idle limit. */
const TTL_S = 25 * 60 * 60;

export class MemoryOfficeStore implements OfficeStore {
  private readonly sessions = new Map<string, string>();

  async get(code: string) {
    const raw = this.sessions.get(code);
    return raw ? (JSON.parse(raw) as OfficeSessionRecord) : null;
  }

  async save(session: OfficeSessionRecord) {
    this.sessions.set(session.code, JSON.stringify(session));
  }
}

export class RedisOfficeStore implements OfficeStore {
  constructor(private readonly redis: Redis) {}

  async get(code: string) {
    const raw = await this.redis.get(`office:${code}`);
    return raw ? (JSON.parse(raw) as OfficeSessionRecord) : null;
  }

  async save(session: OfficeSessionRecord) {
    await this.redis.set(`office:${session.code}`, JSON.stringify(session), 'EX', TTL_S);
  }
}

/** Long-term record of sessions (Postgres when configured); draws join it in O3. */
export interface OfficeRepo {
  created(session: {
    code: string;
    activityId: string;
    title: string;
    hostId: string;
    createdAt: number;
  }): Promise<void>;
  statusChanged(code: string, status: OfficeStatus, at: number): Promise<void>;
  /** A revealed draw, kept for history and verification (30 days). */
  drawRevealed(code: string, record: OfficeDrawRecord): Promise<void>;
  getDraw(code: string, drawId: string): Promise<OfficeDrawRecord | null>;
  /** Revealed draws of a session, newest first. */
  listDraws(code: string, limit: number): Promise<OfficeDrawRecord[]>;
}

export class MemoryOfficeRepo implements OfficeRepo {
  readonly rows = new Map<string, { status: OfficeStatus; closedAt: number | null }>();
  async created(session: { code: string }) {
    this.rows.set(session.code, { status: 'open', closedAt: null });
  }
  readonly draws = new Map<string, OfficeDrawRecord>();
  async drawRevealed(code: string, record: OfficeDrawRecord) {
    this.draws.set(`${code}:${record.drawId}`, structuredClone(record));
  }
  async getDraw(code: string, drawId: string) {
    return this.draws.get(`${code}:${drawId}`) ?? null;
  }
  async listDraws(code: string, limit: number) {
    return [...this.draws.entries()]
      .filter(([key]) => key.startsWith(`${code}:`))
      .map(([, d]) => structuredClone(d))
      .sort((a, b) => b.round - a.round)
      .slice(0, limit);
  }
  async statusChanged(code: string, status: OfficeStatus, at: number) {
    const row = this.rows.get(code);
    if (row) this.rows.set(code, { status, closedAt: status === 'closed' ? at : row.closedAt });
  }
}
