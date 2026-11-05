import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';

/**
 * Something the hub must do at a given time. Plain data (not a closure), so it can live in Redis,
 * survive a restart and be run by any server process (docs/06 §2).
 */
export type Job =
  | { kind: 'clock'; roomId: string; matchId: string }
  | { kind: 'grace'; roomId: string; userId: string }
  | { kind: 'bot'; roomId: string; matchId: string; seq: number }
  | { kind: 'office-expire'; code: string };

export type JobHandler = (job: Job) => Promise<void>;

export interface JobScheduler {
  /** Runs `job` at `atMs`. Scheduling the same key again replaces the previous job. */
  schedule(key: string, atMs: number, job: Job): Promise<void>;
  cancel(key: string): Promise<void>;
  /** Starts running due jobs. Handlers must be idempotent: a job can run more than once after a crash. */
  start(handler: JobHandler): void;
  stop(): Promise<void>;
}

/** In-process timers. Used when there is no Redis: single server, jobs are lost on restart. */
export class TimerJobScheduler implements JobScheduler {
  private timers = new Map<string, NodeJS.Timeout>();
  private jobs = new Map<string, { at: number; job: Job }>();
  private handler: JobHandler | null = null;

  constructor(
    private readonly now: () => number = Date.now,
    private readonly onError: (err: unknown, job: Job) => void = console.error,
  ) {}

  async schedule(key: string, atMs: number, job: Job) {
    this.jobs.set(key, { at: atMs, job });
    this.arm(key);
  }

  async cancel(key: string) {
    this.disarm(key);
    this.jobs.delete(key);
  }

  start(handler: JobHandler) {
    this.handler = handler;
    for (const key of this.jobs.keys()) this.arm(key);
  }

  async stop() {
    this.handler = null;
    for (const key of [...this.timers.keys()]) this.disarm(key);
  }

  private arm(key: string) {
    this.disarm(key);
    const entry = this.jobs.get(key);
    if (!entry || !this.handler) return;
    const timer = setTimeout(
      () => {
        this.timers.delete(key);
        if (this.jobs.get(key) !== entry) return;
        this.jobs.delete(key);
        this.handler?.(entry.job).catch((err: unknown) => this.onError(err, entry.job));
      },
      Math.max(0, entry.at - this.now()),
    );
    timer.unref();
    this.timers.set(key, timer);
  }

  private disarm(key: string) {
    const timer = this.timers.get(key);
    if (timer) clearTimeout(timer);
    this.timers.delete(key);
  }
}

/** Test scheduler: jobs run only when advanceTo() passes their time. */
export class ManualJobScheduler implements JobScheduler {
  readonly jobs = new Map<string, { at: number; job: Job }>();
  private handler: JobHandler | null = null;

  async schedule(key: string, atMs: number, job: Job) {
    this.jobs.set(key, { at: atMs, job });
  }

  async cancel(key: string) {
    this.jobs.delete(key);
  }

  start(handler: JobHandler) {
    this.handler = handler;
  }

  async stop() {
    this.handler = null;
  }

  has(prefix: string): boolean {
    return [...this.jobs.keys()].some((k) => k.startsWith(prefix));
  }

  /** Runs every job due at or before `now`, earliest first, including jobs they schedule. */
  async advanceTo(now: number) {
    for (;;) {
      const due = [...this.jobs.entries()]
        .filter(([, j]) => j.at <= now)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due || !this.handler) return;
      this.jobs.delete(due[0]);
      await this.handler(due[1].job);
    }
  }
}

// Claims up to ARGV[3] due jobs. Each claimed job is pushed ARGV[2] ms into the future (its lease): if the
// process that claimed it dies before acknowledging, the job becomes due again and another process runs it.
const CLAIM = `
local due = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, tonumber(ARGV[3]))
local out = {}
for _, k in ipairs(due) do
  local data = redis.call('HGET', KEYS[2], k)
  if data then
    redis.call('ZADD', KEYS[1], tonumber(ARGV[1]) + tonumber(ARGV[2]), k)
    table.insert(out, k)
    table.insert(out, data)
  else
    redis.call('ZREM', KEYS[1], k)
  end
end
return out`;

// Removes a job only if it is still the version we ran (it may have been rescheduled meanwhile).
const ACK = `
if redis.call('HGET', KEYS[2], ARGV[1]) == ARGV[2] then
  redis.call('ZREM', KEYS[1], ARGV[1])
  redis.call('HDEL', KEYS[2], ARGV[1])
  return 1
end
return 0`;

export interface RedisJobSchedulerOptions {
  /** How often each process looks for due jobs. Also the worst-case delay of a timer. */
  pollMs?: number;
  /** How long a claimed job is reserved before another process may retry it. Must exceed the slowest job. */
  leaseMs?: number;
  batch?: number;
  prefix?: string;
  now?: () => number;
  onError?: (err: unknown, job: Job | null) => void;
}

/**
 * Jobs shared by every server process through Redis: a sorted set of due times plus a hash of payloads.
 * Any process can run any job; a crashed process's jobs are retried after their lease (at-least-once).
 * Server clocks must be roughly in sync (NTP): due times are compared with each process's own clock.
 */
export class RedisJobScheduler implements JobScheduler {
  private readonly due: string;
  private readonly data: string;
  private readonly pollMs: number;
  private readonly leaseMs: number;
  private readonly batch: number;
  private readonly now: () => number;
  private readonly onError: (err: unknown, job: Job | null) => void;
  private handler: JobHandler | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = new Set<Promise<void>>();

  constructor(
    private readonly redis: Redis,
    opts: RedisJobSchedulerOptions = {},
  ) {
    const prefix = opts.prefix ?? 'jobs';
    this.due = `${prefix}:due`;
    this.data = `${prefix}:data`;
    this.pollMs = opts.pollMs ?? 100;
    this.leaseMs = opts.leaseMs ?? 15_000;
    this.batch = opts.batch ?? 50;
    this.now = opts.now ?? Date.now;
    this.onError = opts.onError ?? ((err) => console.error(err));
  }

  async schedule(key: string, atMs: number, job: Job) {
    // A unique version per schedule, so acknowledging an old run never deletes a newer job.
    const payload = JSON.stringify({ v: randomUUID(), job });
    await this.redis.multi().zadd(this.due, atMs, key).hset(this.data, key, payload).exec();
  }

  async cancel(key: string) {
    await this.redis.multi().zrem(this.due, key).hdel(this.data, key).exec();
  }

  start(handler: JobHandler) {
    this.handler = handler;
    this.loop();
  }

  async stop() {
    this.handler = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await Promise.allSettled([...this.running]);
  }

  /** Claims and runs due jobs once. Exposed for tests. */
  async poll(): Promise<number> {
    const handler = this.handler;
    if (!handler) return 0;
    const claimed = (await this.redis.eval(
      CLAIM,
      2,
      this.due,
      this.data,
      this.now(),
      this.leaseMs,
      this.batch,
    )) as string[];
    for (let i = 0; i < claimed.length; i += 2) {
      const key = claimed[i] as string;
      const payload = claimed[i + 1] as string;
      const run = this.runOne(handler, key, payload);
      this.running.add(run);
      void run.finally(() => this.running.delete(run));
    }
    return claimed.length / 2;
  }

  private async runOne(handler: JobHandler, key: string, payload: string) {
    let job: Job | null = null;
    try {
      job = (JSON.parse(payload) as { job: Job }).job;
      await handler(job);
    } catch (err) {
      // Logged and dropped rather than retried forever; a crash (no ack at all) is what the lease covers.
      this.onError(err, job);
    }
    await this.redis
      .eval(ACK, 2, this.due, this.data, key, payload)
      .catch((err: unknown) => this.onError(err, job));
  }

  private loop() {
    if (!this.handler) return;
    this.poll()
      .catch((err: unknown) => this.onError(err, null))
      .finally(() => {
        if (!this.handler) return;
        this.timer = setTimeout(() => this.loop(), this.pollMs);
        this.timer.unref();
      });
  }
}
