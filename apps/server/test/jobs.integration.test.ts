import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';
import { InlineBotRunner } from '../src/bots/bot-runner';
import { GameHub } from '../src/hub/game-hub';
import { RedisJobScheduler, type Job, type JobHandler } from '../src/hub/scheduler';
import { GAME_DEFS } from '../src/registry';
import { RedisLiveStore } from '../src/store/redis-live-store';
import { MemoryHistoryRepo } from '../src/store/repos';
import { alice, bob, silentLog } from './helpers';

const REDIS_URL = process.env.REDIS_URL!;
const connections: Redis[] = [];
const schedulers: RedisJobScheduler[] = [];
const prefixes = new Set<string>();

function connect(): Redis {
  const r = new Redis(REDIS_URL);
  connections.push(r);
  return r;
}

/** A scheduler on its own connection, like a separate server process. */
function process_(prefix: string, opts: { leaseMs?: number } = {}) {
  prefixes.add(prefix);
  const s = new RedisJobScheduler(connect(), { prefix, pollMs: 20, onError: () => {}, ...opts });
  schedulers.push(s);
  return s;
}

const job = (n: number): Job => ({ kind: 'clock', roomId: `r${n}`, matchId: `m${n}` });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(check: () => boolean, timeoutMs = 5_000) {
  const end = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await sleep(10);
  }
}

afterAll(async () => {
  for (const s of schedulers) await Promise.race([s.stop(), sleep(200)]);
  // Each test used its own prefix; remove what is left so dev Redis does not fill up.
  const cleaner = connect();
  for (const p of prefixes) await cleaner.del(`${p}:due`, `${p}:data`);
  for (const r of connections) r.disconnect();
});

describe('RedisJobScheduler', () => {
  it('two processes share the work and every job runs exactly once', async () => {
    const prefix = `test-${randomUUID()}`;
    const ran: string[] = [];
    const handler: JobHandler = async (j) => void ran.push('roomId' in j ? j.roomId : j.code);
    const [a, b] = [process_(prefix), process_(prefix)];
    for (let i = 0; i < 40; i++) await a.schedule(`k${i}`, Date.now() + (i % 5) * 10, job(i));
    a.start(handler);
    b.start(handler);
    await until(() => ran.length >= 40);
    await sleep(100);
    expect(ran).toHaveLength(40);
    expect(new Set(ran).size).toBe(40);
  });

  it('does not run a job before it is due; reschedule replaces; cancel removes', async () => {
    const prefix = `test-${randomUUID()}`;
    const ran: string[] = [];
    const s = process_(prefix);
    s.start(async (j) => void ran.push('roomId' in j ? j.roomId : j.code));
    await s.schedule('later', Date.now() + 300, job(1));
    await s.schedule('replaced', Date.now() + 50, job(2));
    await s.schedule('replaced', Date.now() + 100, job(3));
    await s.schedule('cancelled', Date.now() + 50, job(4));
    await s.cancel('cancelled');
    await sleep(200);
    expect(ran).toEqual(['r3']);
    await until(() => ran.length === 2);
    expect(ran).toEqual(['r3', 'r1']);
  });

  it('a job claimed by a process that crashes is run by another one after its lease', async () => {
    const prefix = `test-${randomUUID()}`;
    let release!: () => void;
    const hang = new Promise<void>((r) => (release = r));
    const crashing = process_(prefix, { leaseMs: 300 });
    let claimed = false;
    crashing.start(async () => {
      claimed = true;
      await hang; // never finishes: this process "dies" while running the job
    });
    await crashing.schedule('k', Date.now(), job(1));
    await until(() => claimed);
    void crashing.stop();

    const ran: string[] = [];
    const survivor = process_(prefix);
    survivor.start(async (j) => void ran.push('roomId' in j ? j.roomId : j.code));
    await sleep(150);
    expect(ran).toEqual([]); // still leased
    await until(() => ran.length === 1);
    expect(ran).toEqual(['r1']);
    release();
  });

  it('finishing an old run does not delete a job that was rescheduled meanwhile', async () => {
    const prefix = `test-${randomUUID()}`;
    let release!: () => void;
    const slow = new Promise<void>((r) => (release = r));
    const first = process_(prefix, { leaseMs: 5_000 });
    let started = false;
    first.start(async () => {
      started = true;
      await slow;
    });
    await first.schedule('k', Date.now(), job(1));
    await until(() => started);
    // Stop claiming new jobs (stop() would wait for the running one, which is still busy).
    const stopped = first.stop();
    // While the first run is still going, the key gets a new job (e.g. a new move moved the deadline).
    const other = process_(prefix);
    await other.schedule('k', Date.now() + 100, job(2));
    release();
    await stopped; // the first run has acknowledged now; it must not have removed job 2
    const ran: string[] = [];
    other.start(async (j) => void ran.push('roomId' in j ? j.roomId : j.code));
    await until(() => ran.length === 1);
    expect(ran).toEqual(['r2']);
  });
});

describe('server restart', () => {
  it('a match clock still runs out after the server that started it went away', async () => {
    const prefix = `test-${randomUUID()}`;
    const store = new RedisLiveStore(connect());
    const makeHub = (jobs: RedisJobScheduler) => {
      const hub = new GameHub({
        store,
        history: new MemoryHistoryRepo(),
        games: GAME_DEFS,
        bots: new InlineBotRunner(),
        jobs,
        notifier: { roomUpdated() {}, matchUpdated() {}, chatMessage() {} },
        log: silentLog,
      });
      jobs.start(hub.runJob);
      return hub;
    };

    // Server A hosts a blitz game with a very short clock…
    const jobsA = process_(prefix);
    const hubA = makeHub(jobsA);
    const room = await hubA.createRoom(alice, {
      gameId: 'caro',
      timeControl: { type: 'fischer', baseMs: 800, incrementMs: 0 },
      disconnectPolicy: 'forfeit',
      hostSeat: 0,
    });
    await hubA.joinRoom(bob, room.code);
    await hubA.takeSeat(bob, room.id, 1);
    await hubA.setReady(bob, room.id, true);
    await hubA.startMatch(alice, room.id);
    // …and goes down right away.
    await jobsA.stop();

    // Server B is running and picks up A's timer from Redis.
    makeHub(process_(prefix));
    const matchId = (await store.getRoom(room.id))!.matchId!;
    const end = Date.now() + 5_000;
    let result = (await store.getMatch(matchId))!.result;
    while (!result && Date.now() < end) {
      await sleep(50);
      result = (await store.getMatch(matchId))!.result;
    }
    expect(result).toEqual({ kind: 'win', winners: [1], reason: 'timeout' });
  });
});
