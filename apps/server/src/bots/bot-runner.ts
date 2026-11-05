import { Worker } from 'node:worker_threads';
import { createRng, type Seat } from '@bg/engine';
import type { BotLevel } from '@bg/protocol';
import { GAME_BOTS } from '../registry';

export interface BotRequest {
  gameId: string;
  /** The bot's playerView, never more (rule B4). */
  view: unknown;
  seat: Seat;
  level: BotLevel;
  seed: string;
  moveIndex: number;
}

export interface BotRunner {
  choose(req: BotRequest): Promise<unknown>;
  close(): Promise<void>;
}

/** Hard cap on thinking time; each level also has its own, smaller budget. */
export const BOT_MAX_THINK_MS = 3_000;

export function computeBotMove(req: BotRequest): unknown {
  const bot = GAME_BOTS[req.gameId];
  if (!bot) throw new Error(`no bot for game ${req.gameId}`);
  return bot.chooseMove({
    state: req.view,
    seat: req.seat,
    level: req.level,
    // Separate stream from the match RNG, so bot choices are reproducible (rule B1).
    rng: createRng(`bot:${req.seed}`, req.moveIndex),
    deadlineMs: Date.now() + BOT_MAX_THINK_MS,
  });
}

/** Runs bots on the main thread. Fine for tests and tiny deployments; blocks the event loop while thinking. */
export class InlineBotRunner implements BotRunner {
  async choose(req: BotRequest) {
    await new Promise((r) => setImmediate(r));
    return computeBotMove(req);
  }

  async close() {}
}

type Job = { req: BotRequest; resolve: (move: unknown) => void; reject: (err: Error) => void };

/** A plain-JS entry that registers tsx inside the worker, then loads bot-worker.ts. */
const DEFAULT_WORKER = new URL('./bot-worker-boot.mjs', import.meta.url);
/** Workers that die before answering anything this many times in a row are not respawned again. */
const MAX_STARTUP_FAILURES = 3;

/**
 * Runs bots in worker threads so the server stays responsive (rule B5).
 * If workers cannot start at all (a broken install), it stops respawning them and thinks on the
 * main thread instead: slower, but bots still play properly and nothing spins.
 */
export class WorkerBotRunner implements BotRunner {
  private idle: Worker[] = [];
  private queue: Job[] = [];
  private busy = new Map<Worker, Job>();
  private startupFailures = 0;
  private broken = false;
  private readonly inline = new InlineBotRunner();

  constructor(
    size: number,
    private readonly script: URL = DEFAULT_WORKER,
    private readonly onBroken: (err: Error) => void = () => {},
  ) {
    for (let i = 0; i < size; i++) this.idle.push(this.spawn());
  }

  /** True once workers have been given up on. */
  get degraded(): boolean {
    return this.broken;
  }

  choose(req: BotRequest): Promise<unknown> {
    if (this.broken) return this.inline.choose(req);
    return new Promise((resolve, reject) => {
      this.queue.push({ req, resolve, reject });
      this.pump();
    });
  }

  async close() {
    await Promise.all([...this.idle, ...this.busy.keys()].map((w) => w.terminate()));
    this.idle = [];
    this.busy.clear();
  }

  private spawn(): Worker {
    const worker = new Worker(this.script);
    let answered = false;
    worker.on('message', (msg: { ok: true; move: unknown } | { ok: false; error: string }) => {
      answered = true;
      this.startupFailures = 0;
      const job = this.busy.get(worker);
      this.busy.delete(worker);
      this.idle.push(worker);
      if (job) {
        if (msg.ok) job.resolve(msg.move);
        else job.reject(new Error(msg.error));
      }
      this.pump();
    });
    worker.on('error', (err) => {
      const job = this.busy.get(worker);
      this.busy.delete(worker);
      this.idle = this.idle.filter((w) => w !== worker);
      if (this.broken) {
        if (job) this.runInline(job);
        return;
      }
      if (!answered) {
        // It died before doing anything: the job was not its fault, so it waits for the next worker.
        if (job) this.queue.unshift(job);
        if (++this.startupFailures >= MAX_STARTUP_FAILURES) {
          // Respawning would only fail again, over and over: think on the main thread from now on.
          this.giveUp(err);
          return;
        }
      } else {
        job?.reject(err);
      }
      this.idle.push(this.spawn());
      this.pump();
    });
    return worker;
  }

  private giveUp(err: Error) {
    if (this.broken) return;
    this.broken = true;
    this.onBroken(err);
    const pending = [...this.queue, ...this.busy.values()];
    const workers = [...this.idle, ...this.busy.keys()];
    this.queue = [];
    this.idle = [];
    this.busy.clear();
    void Promise.all(workers.map((w) => w.terminate()));
    for (const job of pending) this.runInline(job);
  }

  private runInline(job: Job) {
    this.inline.choose(job.req).then(job.resolve, job.reject);
  }

  private pump() {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.pop()!;
      const job = this.queue.shift()!;
      this.busy.set(worker, job);
      worker.postMessage(job.req);
    }
  }
}
