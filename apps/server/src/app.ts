import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { createAdapter } from '@socket.io/redis-adapter';
import Fastify from 'fastify';
import { Redis } from 'ioredis';
import { Server } from 'socket.io';
import { MemoryAdminRepo, type AdminRepo } from './admin/admin-repo';
import { MemoryAnalyticsRepo, type AnalyticsRepo } from './analytics/analytics-repo';
import { AnalyticsService } from './analytics/analytics-service';
import { PgAnalyticsRepo } from './db/pg-analytics-repo';
import { registerAdminRoutes } from './admin/admin-routes';
import { AdminService } from './admin/admin-service';
import { AuthService } from './auth/auth-service';
import { TokenService } from './auth/tokens';
import { InlineBotRunner, WorkerBotRunner, type BotRunner } from './bots/bot-runner';
import type { ServerConfig } from './config';
import { createDb, migrateToLatest } from './db/database';
import { PgAdminRepo } from './db/pg-admin-repo';
import { PgHistoryRepo, PgOfficeRepo, PgRatingRepo, PgUserRepo } from './db/pg-repos';
import { registerCompetitiveRoutes } from './http/competitive-routes';
import { Matchmaker } from './matchmaking/matchmaker';
import { MemoryRatingRepo, RatingService, type RatingRepo } from './ratings/rating-service';
import { GameHub } from './hub/game-hub';
import { RedisJobScheduler, TimerJobScheduler, type JobScheduler } from './hub/scheduler';
import { HistoryService } from './history/history-service';
import { registerRoutes } from './http/routes';
import { registerStatsRoutes } from './stats/stats-routes';
import { MemoryVisitRepo, type VisitRepo } from './stats/visit-repo';
import { VisitService } from './stats/visit-service';
import { PgVisitRepo } from './db/pg-visit-repo';
import { PgLearnEventRepo } from './db/pg-learn-repo';
import { LearnEventService, MemoryLearnEventRepo, type LearnEventRepo } from './stats/learn-events';
import { attachGateway, createNotifier, type IoServer } from './realtime/gateway';
import { GAME_DEFS } from './registry';
import { attachOfficeGateway, createOfficeNotifier, type OfficeNamespace } from './office/office-gateway';
import { OfficeHub } from './office/office-hub';
import { registerOfficeRoutes } from './office/office-routes';
import { OFFICE_ACTIVITIES } from './office/registry';
import {
  MemoryOfficeRepo,
  MemoryOfficeStore,
  RedisOfficeStore,
  type OfficeRepo,
  type OfficeStore,
} from './office/store';
import { MemoryLiveStore, type LiveStore } from './store/live-store';
import { RedisLiveStore } from './store/redis-live-store';
import { MemoryHistoryRepo, MemoryUserRepo, type HistoryRepo, type UserRepo } from './store/repos';

export interface ServerOverrides {
  store?: LiveStore;
  users?: UserRepo;
  history?: HistoryRepo;
  bots?: BotRunner;
  jobs?: JobScheduler;
  ratings?: RatingRepo;
  officeStore?: OfficeStore;
  officeRepo?: OfficeRepo;
  adminRepo?: AdminRepo;
  visitRepo?: VisitRepo;
  learnRepo?: LearnEventRepo;
  analyticsRepo?: AnalyticsRepo;
  /** How often waiting quick-match players are re-checked (widening rating windows). */
  matchSweepMs?: number;
}

/** Builds the HTTP + Socket.IO server. Tests pass overrides to run fully in memory. */
export async function buildServer(config: ServerConfig, overrides: ServerOverrides = {}) {
  const app = Fastify({
    logger: config.LOG_LEVEL === 'silent' ? false : { level: config.LOG_LEVEL },
    bodyLimit: 16 * 1024,
    // Behind Render's proxy the client address is in X-Forwarded-For; without this everyone shares one address.
    trustProxy: config.NODE_ENV === 'production',
  });
  // Only the routes that opt in are limited (sign-in, sign-up, guest).
  await app.register(rateLimit, { global: false });
  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT'],
  });

  const cleanups: (() => Promise<void>)[] = [];

  let users = overrides.users;
  let history = overrides.history;
  let ratingRepo = overrides.ratings;
  let officeRepo = overrides.officeRepo;
  let adminRepo = overrides.adminRepo;
  let visitRepo = overrides.visitRepo;
  let learnRepo = overrides.learnRepo;
  let analyticsRepo = overrides.analyticsRepo;
  const missing = [users, history, ratingRepo, officeRepo, adminRepo, visitRepo, learnRepo].some((r) => !r);
  if (missing && config.DATABASE_URL) {
    const db = createDb(config.DATABASE_URL);
    await migrateToLatest(db);
    users ??= new PgUserRepo(db);
    history ??= new PgHistoryRepo(db);
    ratingRepo ??= new PgRatingRepo(db);
    officeRepo ??= new PgOfficeRepo(db);
    adminRepo ??= new PgAdminRepo(db);
    visitRepo ??= new PgVisitRepo(db);
    learnRepo ??= new PgLearnEventRepo(db);
    analyticsRepo ??= new PgAnalyticsRepo(db);
    cleanups.push(() => db.destroy());
  }
  users ??= new MemoryUserRepo();
  history ??= new MemoryHistoryRepo();
  ratingRepo ??= new MemoryRatingRepo();
  adminRepo ??= new MemoryAdminRepo();
  visitRepo ??= new MemoryVisitRepo();
  learnRepo ??= new MemoryLearnEventRepo();
  const ratings = new RatingService(ratingRepo);
  // In memory, the dashboard reads the in-memory repos; a repo of another sort counts as empty.
  analyticsRepo ??= new MemoryAnalyticsRepo(
    users instanceof MemoryUserRepo ? users : new MemoryUserRepo(),
    history instanceof MemoryHistoryRepo ? history : new MemoryHistoryRepo(),
    learnRepo instanceof MemoryLearnEventRepo ? learnRepo : new MemoryLearnEventRepo(),
    adminRepo instanceof MemoryAdminRepo ? adminRepo : new MemoryAdminRepo(),
  );

  const io: IoServer = new Server(app.server, {
    cors: { origin: config.corsOrigins, credentials: true },
    // Recover briefly lost connections without a full rejoin.
    connectionStateRecovery: { maxDisconnectionDuration: 30_000 },
  });

  let store = overrides.store;
  let redisForJobs: Redis | null = null;
  if (!store && config.REDIS_URL) {
    const redis = new Redis(config.REDIS_URL);
    redisForJobs = redis;
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
    (config.BOT_WORKERS > 0
      ? new WorkerBotRunner(config.BOT_WORKERS, undefined, (err) =>
          app.log.error({ err }, 'bot workers cannot start; bots now think on the main thread'),
        )
      : new InlineBotRunner());
  const onJobError = (err: unknown, job: unknown) => app.log.error({ err, job }, 'job failed');
  // With Redis, timers live there too: they survive restarts and any process can run them.
  const jobs =
    overrides.jobs ??
    (redisForJobs
      ? new RedisJobScheduler(redisForJobs, { onError: onJobError })
      : new TimerJobScheduler(Date.now, onJobError));
  const log = app.log;

  // Admin and moderation (M4b). A ban drops the user's live connections right away.
  let matchmakerRef: Matchmaker | null = null;
  const admin = new AdminService({
    repo: adminRepo,
    users,
    gameIds: Object.keys(GAME_DEFS),
    adminEmails: config.adminEmails,
    adminSelfRegister: config.ADMIN_SELF_REGISTER === 'true',
    roomChat: async (code) => {
      const roomId = await store.roomIdByCode(code);
      return roomId ? store.getChat(roomId) : [];
    },
    onBanned: async (userId) => {
      io.in('user:' + userId).disconnectSockets(true);
      io.of('/office')
        .in('office-user:' + userId)
        .disconnectSockets(true);
      await matchmakerRef?.leave(userId);
    },
  });
  const granted = await admin.bootstrapSuperAdmins();
  if (granted !== null) {
    // No addresses in the log.
    if (granted > 0) app.log.info({ granted }, 'first super admin granted from ADMIN_EMAILS');
    else
      app.log.warn('no super admin yet: sign up first, then list that address in ADMIN_EMAILS and restart');
  }
  const isGameEnabled = (gameId: string) => admin.isGameEnabled(gameId);

  const hub = new GameHub({
    store,
    history,
    games: GAME_DEFS,
    bots,
    jobs,
    notifier: createNotifier(io),
    log,
    ratings,
    graceMs: config.GRACE_MS,
    botDelayMs: config.BOT_DELAY_MS,
    isGameEnabled,
  });
  const auth = new AuthService(users, new TokenService(config.JWT_SECRET), {
    isBanned: (id) => admin.isBanned(id),
    isAdmin: (u) => admin.isAdmin(u),
    mayRegister: (email) => admin.mayRegister(email),
    onRegistered: (u) => admin.onRegistered(u),
  });
  registerRoutes(app, auth, new HistoryService(history, users), users, config.AUTH_RATE_LIMIT);
  registerCompetitiveRoutes(app, { auth, ratings: ratingRepo, users, store, games: GAME_DEFS });
  registerAdminRoutes(app, auth, admin);
  registerStatsRoutes(
    app,
    auth,
    admin,
    new VisitService(visitRepo),
    new LearnEventService(learnRepo),
    new AnalyticsService(analyticsRepo, users),
    config.AUTH_RATE_LIMIT * 3,
  );
  const matchmaker = new Matchmaker({
    store,
    hub,
    games: GAME_DEFS,
    ratings,
    log,
    notify: (userId, match) => io.to(`user:${userId}`).emit('queue:matched', match),
    isGameEnabled,
  });
  matchmakerRef = matchmaker;
  attachGateway(io, hub, auth, log, matchmaker, admin);

  // Office area: its own hub and namespace on the same infrastructure (ADR-0005).
  const officeNs = io.of('/office') as unknown as OfficeNamespace;
  const officeHub = new OfficeHub({
    store:
      overrides.officeStore ?? (redisForJobs ? new RedisOfficeStore(redisForJobs) : new MemoryOfficeStore()),
    repo: officeRepo ?? new MemoryOfficeRepo(),
    withLock: (key, fn) => store.withLock(key, fn),
    jobs,
    activities: OFFICE_ACTIVITIES,
    notifier: createOfficeNotifier(officeNs),
    log,
  });
  registerOfficeRoutes(app, officeHub);
  attachOfficeGateway(officeNs, officeHub, auth, log);

  jobs.start((job) =>
    job.kind === 'office-expire' || job.kind === 'office-reveal' ? officeHub.runJob(job) : hub.runJob(job),
  );
  // Periodic re-check so ranked rating windows widen for players who are still waiting.
  const sweep = setInterval(
    () => void matchmaker.sweep().catch((err: unknown) => log.error({ err }, 'matchmaking sweep failed')),
    overrides.matchSweepMs ?? 2_000,
  );
  sweep.unref();

  const close = async () => {
    clearInterval(sweep);
    await jobs.stop();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await app.close();
    await bots.close();
    for (const fn of cleanups.reverse()) await fn().catch(() => undefined);
  };

  return { app, io, hub, officeHub, auth, admin, matchmaker, ratings, close };
}
