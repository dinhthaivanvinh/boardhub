import cors from '@fastify/cors';
import { createAdapter } from '@socket.io/redis-adapter';
import Fastify from 'fastify';
import { Redis } from 'ioredis';
import { Server } from 'socket.io';
import { AuthService } from './auth/auth-service';
import { TokenService } from './auth/tokens';
import { InlineBotRunner, WorkerBotRunner, type BotRunner } from './bots/bot-runner';
import type { ServerConfig } from './config';
import { createDb, migrateToLatest } from './db/database';
import { PgHistoryRepo, PgUserRepo } from './db/pg-repos';
import { GameHub } from './hub/game-hub';
import { TimerScheduler, type Scheduler } from './hub/scheduler';
import { HistoryService } from './history/history-service';
import { registerRoutes } from './http/routes';
import { attachGateway, createNotifier, type IoServer } from './realtime/gateway';
import { GAME_DEFS } from './registry';
import { MemoryLiveStore, type LiveStore } from './store/live-store';
import { RedisLiveStore } from './store/redis-live-store';
import { MemoryHistoryRepo, MemoryUserRepo, type HistoryRepo, type UserRepo } from './store/repos';

export interface ServerOverrides {
  store?: LiveStore;
  users?: UserRepo;
  history?: HistoryRepo;
  bots?: BotRunner;
  scheduler?: Scheduler;
}

/** Builds the HTTP + Socket.IO server. Tests pass overrides to run fully in memory. */
export async function buildServer(config: ServerConfig, overrides: ServerOverrides = {}) {
  const app = Fastify({
    logger: config.LOG_LEVEL === 'silent' ? false : { level: config.LOG_LEVEL },
    bodyLimit: 16 * 1024,
  });
  await app.register(cors, { origin: config.corsOrigins, credentials: true });

  const cleanups: (() => Promise<void>)[] = [];

  let users = overrides.users;
  let history = overrides.history;
  if ((!users || !history) && config.DATABASE_URL) {
    const db = createDb(config.DATABASE_URL);
    await migrateToLatest(db);
    users ??= new PgUserRepo(db);
    history ??= new PgHistoryRepo(db);
    cleanups.push(() => db.destroy());
  }
  users ??= new MemoryUserRepo();
  history ??= new MemoryHistoryRepo();

  const io: IoServer = new Server(app.server, {
    cors: { origin: config.corsOrigins, credentials: true },
    // Recover briefly lost connections without a full rejoin.
    connectionStateRecovery: { maxDisconnectionDuration: 30_000 },
  });

  let store = overrides.store;
  if (!store && config.REDIS_URL) {
    const redis = new Redis(config.REDIS_URL);
    const pub = new Redis(config.REDIS_URL);
    const sub = pub.duplicate();
    io.adapter(createAdapter(pub, sub));
    store = new RedisLiveStore(redis);
    cleanups.push(async () => {
      await pub.quit();
      await sub.quit();
    });
  }
  store ??= new MemoryLiveStore();
  cleanups.push(() => store.close());

  const bots =
    overrides.bots ??
    (config.BOT_WORKERS > 0 ? new WorkerBotRunner(config.BOT_WORKERS) : new InlineBotRunner());
  const scheduler =
    overrides.scheduler ?? new TimerScheduler(Date.now, (err) => app.log.error({ err }, 'timer failed'));
  const log = app.log;

  const hub = new GameHub({
    store,
    history,
    games: GAME_DEFS,
    bots,
    scheduler,
    notifier: createNotifier(io),
    log,
    graceMs: config.GRACE_MS,
    botDelayMs: config.BOT_DELAY_MS,
  });
  const auth = new AuthService(users, new TokenService(config.JWT_SECRET));
  registerRoutes(app, auth, new HistoryService(history, users));
  attachGateway(io, hub, auth, log);

  const close = async () => {
    scheduler.clearAll();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await app.close();
    await bots.close();
    for (const fn of cleanups.reverse()) await fn().catch(() => undefined);
  };

  return { app, io, hub, auth, close };
}
