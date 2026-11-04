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

/** Runs bots in worker threads so the server stays responsive (rule B5). */
export class WorkerBotRunner implements BotRunner {
  private idle: Worker[] = [];
  private queue: Job[] = [];
  private busy = new Map<Worker, Job>();

  constructor(size: number) {
    for (let i = 0; i < size; i++) this.idle.push(this.spawn());
  }

  choose(req: BotRequest): Promise<unknown> {
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
    // execArgv is inherited, so workers also run TypeScript when the server runs under tsx.
    const worker = new Worker(new URL('./bot-worker.ts', import.meta.url));
    worker.on('message', (msg: { ok: true; move: unknown } | { ok: false; error: string }) => {
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
      job?.reject(err);
      this.idle.push(this.spawn());
      this.pump();
    });
    return worker;
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
