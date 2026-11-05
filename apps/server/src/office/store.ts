import type { Redis } from 'ioredis';
import type { OfficeParticipant, OfficeStatus } from '@bg/protocol';

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
}

export class MemoryOfficeRepo implements OfficeRepo {
  readonly rows = new Map<string, { status: OfficeStatus; closedAt: number | null }>();
  async created(session: { code: string }) {
    this.rows.set(session.code, { status: 'open', closedAt: null });
  }
  async statusChanged(code: string, status: OfficeStatus, at: number) {
    const row = this.rows.get(code);
    if (row) this.rows.set(code, { status, closedAt: status === 'closed' ? at : row.closedAt });
  }
}
