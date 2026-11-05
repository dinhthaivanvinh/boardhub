import { beforeEach, describe, expect, it } from 'vitest';
import type { Avatar } from '@bg/avatars/schema';
import { OFFICE_MAX_PARTICIPANTS } from '@bg/protocol';
import { ManualJobScheduler } from '../src/hub/scheduler';
import { OFFICE_IDLE_MS, OfficeHub, type OfficeNotifier } from '../src/office/office-hub';
import { OFFICE_ACTIVITIES } from '../src/office/registry';
import { MemoryOfficeRepo, MemoryOfficeStore } from '../src/office/store';
import { MemoryLiveStore } from '../src/store/live-store';
import { silentLog } from './helpers';

const host = { userId: 'u-host', name: 'Chủ trì' };
const an = { userId: 'u-an', name: 'An' };
const binh = { userId: 'u-binh', name: 'Bình' };
const fox: Avatar = {
  v: 1,
  species: 'fox',
  body: '#f97316',
  accent: '#f8fafc',
  pattern: 'plain',
  eyes: 'happy',
  mouth: 'smile',
  accessory: 'none',
  accessoryColor: '#ef4444',
  background: '#bae6fd',
};

type Event = { kind: string; [k: string]: unknown };

function makeOfficeHub() {
  let now = 1_000_000;
  const events: Event[] = [];
  const notifier: OfficeNotifier = {
    participant: (code, seq, participant) => events.push({ kind: 'participant', code, seq, participant }),
    removed: (code, seq, id, reason) => events.push({ kind: 'removed', code, seq, id, reason }),
    session: (code, seq, session) => events.push({ kind: 'session', code, seq, session }),
    activity: (code, seq, views) => events.push({ kind: 'activity', code, seq, views }),
    kicked: (code, userId) => events.push({ kind: 'kicked', code, userId }),
  };
  const jobs = new ManualJobScheduler();
  const live = new MemoryLiveStore();
  const repo = new MemoryOfficeRepo();
  const codes = ['AAAAAA', 'BBBBBB', 'CCCCCC'];
  const hub = new OfficeHub({
    store: new MemoryOfficeStore(),
    repo,
    withLock: (k, fn) => live.withLock(k, fn),
    jobs,
    activities: OFFICE_ACTIVITIES,
    notifier,
    log: silentLog,
    now: () => now,
    newCode: () => codes.shift() ?? 'ZZZZZZ',
  });
  jobs.start((job) => (job.kind === 'office-expire' ? hub.runJob(job) : Promise.resolve()));
  return {
    hub,
    events,
    jobs,
    repo,
    advance: async (ms: number) => {
      now += ms;
      await jobs.advanceTo(now);
    },
  };
}

let t: ReturnType<typeof makeOfficeHub>;
let code: string;

beforeEach(async () => {
  t = makeOfficeHub();
  const created = await t.hub.create(host, {
    activityId: 'lucky-animal',
    title: 'Ai mua trà sữa?',
    settings: {},
  });
  code = created.code;
  t.events.length = 0;
});

describe('creating a session', () => {
  it('the creator hosts, with a code and the activity set up', async () => {
    const s = await t.hub.resync(host, code, 'host');
    expect(s).toMatchObject({ code: 'AAAAAA', title: 'Ai mua trà sữa?', status: 'open', hostId: 'u-host' });
    expect(s.me).toEqual({ id: 'u-host', isHost: true, screen: 'host', joined: false });
    expect(s.activity).toMatchObject({ settings: { mode: 'race', n: 1 }, rounds: [] });
    expect(t.repo.rows.get(code)).toEqual({ status: 'open', closedAt: null });
  });

  it('refuses unknown activities and bad settings', async () => {
    await expect(t.hub.create(host, { activityId: 'nope', title: '', settings: {} })).rejects.toThrow(
      'office.unknown_activity',
    );
    await expect(
      t.hub.create(host, { activityId: 'lucky-animal', title: '', settings: { n: 99 } }),
    ).rejects.toThrow('office.bad_settings');
  });
});

describe('joining', () => {
  it('a participant is added with their animal; everyone is told (one small event)', async () => {
    const s = await t.hub.join(an, { code, screen: 'participant', avatar: fox });
    expect(s.me.joined).toBe(true);
    expect(s.participants).toEqual([
      expect.objectContaining({ id: 'u-an', name: 'An', avatar: fox, online: true }),
    ]);
    expect(t.events).toEqual([
      expect.objectContaining({ kind: 'participant', participant: expect.objectContaining({ id: 'u-an' }) }),
    ]);
  });

  it('without an animal, a participant gets their default one', async () => {
    const s = await t.hub.join(binh, { code, screen: 'participant' });
    expect(s.participants[0]!.avatar.v).toBe(1);
  });

  it('a second tab or a reconnect does not add the same person twice', async () => {
    await t.hub.join(an, { code, screen: 'participant', avatar: fox });
    await t.hub.disconnected(an.userId, code);
    expect((await t.hub.resync(host, code, 'host')).participants[0]!.online).toBe(false);
    const again = await t.hub.join(an, { code, screen: 'participant', name: 'An Nguyễn' });
    expect(again.participants).toHaveLength(1);
    expect(again.participants[0]).toMatchObject({ online: true, name: 'An Nguyễn', avatar: fox });
  });

  it('only the host may open the host screen; anyone may open the stage', async () => {
    await expect(t.hub.join(an, { code, screen: 'host' })).rejects.toThrow('office.not_host');
    const stage = await t.hub.join(an, { code, screen: 'stage' });
    expect(stage.me).toMatchObject({ screen: 'stage', joined: false });
    await expect(t.hub.join(an, { code: 'QQQQQQ', screen: 'stage' })).rejects.toThrow('office.not_found');
  });

  it('a locked session takes no newcomers, but people already in can come back', async () => {
    await t.hub.join(an, { code, screen: 'participant' });
    await t.hub.host(host, { code, op: 'lock' });
    await expect(t.hub.join(binh, { code, screen: 'participant' })).rejects.toThrow('office.locked');
    await expect(t.hub.join(an, { code, screen: 'participant' })).resolves.toBeTruthy();
    await t.hub.host(host, { code, op: 'unlock' });
    await expect(t.hub.join(binh, { code, screen: 'participant' })).resolves.toBeTruthy();
  });

  it(`at most ${OFFICE_MAX_PARTICIPANTS} people`, async () => {
    for (let i = 0; i < OFFICE_MAX_PARTICIPANTS; i++) {
      await t.hub.join({ userId: `u${i}`, name: `P${i}` }, { code, screen: 'participant' });
    }
    await expect(t.hub.join(an, { code, screen: 'participant' })).rejects.toThrow('office.full');
    await expect(t.hub.host(host, { code, op: 'add-absent', name: 'Vắng', avatar: fox })).rejects.toThrow(
      'office.full',
    );
  });

  it('leaving and updating yourself', async () => {
    await t.hub.join(an, { code, screen: 'participant' });
    await t.hub.updateMe(an, { code, avatar: fox, name: 'Án' });
    expect((await t.hub.resync(host, code, 'host')).participants[0]).toMatchObject({
      name: 'Án',
      avatar: fox,
    });
    await expect(t.hub.updateMe(binh, { code, name: 'x' })).rejects.toThrow('office.not_participant');
    await t.hub.leave(an, code);
    expect((await t.hub.resync(host, code, 'host')).participants).toEqual([]);
    expect(t.events.at(-1)).toMatchObject({ kind: 'removed', id: 'u-an', reason: 'left' });
  });
});

describe('host controls', () => {
  beforeEach(async () => {
    await t.hub.join(an, { code, screen: 'participant' });
    await t.hub.join(binh, { code, screen: 'participant' });
    t.events.length = 0;
  });

  it('only the host', async () => {
    for (const op of [{ op: 'lock' }, { op: 'kick', id: 'u-binh' }, { op: 'close' }] as const) {
      await expect(t.hub.host(an, { code, ...op })).rejects.toThrow('office.not_host');
    }
  });

  it('kick: removed, told, and cannot come back', async () => {
    await t.hub.host(host, { code, op: 'kick', id: 'u-binh' });
    expect(t.events.map((e) => e.kind)).toEqual(['removed', 'kicked']);
    await expect(t.hub.join(binh, { code, screen: 'participant' })).rejects.toThrow('office.locked');
  });

  it('rename, add someone absent, and kick the absent one', async () => {
    await t.hub.host(host, { code, op: 'rename', id: 'u-an', name: 'An (HR)' });
    await t.hub.host(host, { code, op: 'add-absent', name: 'Chi (nghỉ phép)', avatar: fox });
    const s = await t.hub.resync(host, code, 'host');
    expect(s.participants.find((p) => p.id === 'u-an')!.name).toBe('An (HR)');
    const absent = s.participants.find((p) => p.absent)!;
    expect(absent).toMatchObject({ name: 'Chi (nghỉ phép)', online: false });
    expect(absent.id).toMatch(/^absent:/);
    await t.hub.host(host, { code, op: 'kick', id: absent.id });
    expect(t.events.filter((e) => e.kind === 'kicked')).toEqual([]); // nobody to tell
    await expect(t.hub.host(host, { code, op: 'rename', id: 'nobody', name: 'x' })).rejects.toThrow(
      'office.not_participant',
    );
  });

  it('transfer: the new host controls, the old one no longer does', async () => {
    await t.hub.host(host, { code, op: 'transfer', id: 'u-an' });
    expect((await t.hub.resync(an, code, 'host')).me.isHost).toBe(true);
    await expect(t.hub.host(host, { code, op: 'lock' })).rejects.toThrow('office.not_host');
    await t.hub.host(an, { code, op: 'lock' });
  });

  it('close: the session is read-only and recorded as closed', async () => {
    await t.hub.host(host, { code, op: 'close' });
    expect(t.events.at(-1)).toMatchObject({ kind: 'session', session: { status: 'closed' } });
    await expect(t.hub.join(binh, { code, screen: 'participant' })).rejects.toThrow('office.closed');
    await expect(t.hub.host(host, { code, op: 'lock' })).rejects.toThrow('office.closed');
    expect(t.repo.rows.get(code)?.status).toBe('closed');
  });

  it('activity actions go through the activity, with per-screen views', async () => {
    await expect(t.hub.action(an, code, { kind: 'configure', patch: { n: 2 } })).rejects.toThrow(
      'office.not_host',
    );
    await expect(t.hub.action(host, code, { kind: 'dance' })).rejects.toThrow('office.bad_action');
    await t.hub.action(host, code, { kind: 'configure', patch: { n: 2 } });
    const e = t.events.at(-1)!;
    expect(e.kind).toBe('activity');
    expect(Object.keys(e.views as object).sort()).toEqual(['host', 'participant', 'stage']);
    expect((await t.hub.resync(an, code, 'participant')).activity).toMatchObject({ settings: { n: 2 } });
  });

  it('every change increases seq', async () => {
    const before = (await t.hub.resync(host, code, 'host')).seq;
    await t.hub.host(host, { code, op: 'lock' });
    await t.hub.host(host, { code, op: 'rename', id: 'u-an', name: 'A' });
    expect((await t.hub.resync(host, code, 'host')).seq).toBe(before + 2);
  });
});

describe('expiry', () => {
  it('closes after 24 hours without activity, and activity pushes it back', async () => {
    await t.advance(OFFICE_IDLE_MS - 1000);
    await t.hub.join(an, { code, screen: 'participant' }); // activity: the deadline moves
    await t.advance(2000);
    expect((await t.hub.resync(host, code, 'host')).status).toBe('open');
    await t.advance(OFFICE_IDLE_MS);
    expect((await t.hub.resync(host, code, 'host')).status).toBe('closed');
    expect(t.repo.rows.get(code)?.status).toBe('closed');
  });

  it('a job that runs twice is harmless', async () => {
    await t.advance(OFFICE_IDLE_MS + 1);
    await t.hub.runJob({ kind: 'office-expire', code });
    await t.hub.runJob({ kind: 'office-expire', code: 'NOPE00' });
    expect(t.events.filter((e) => e.kind === 'session')).toHaveLength(1);
  });

  it('the portal can ask whether a code is an office session', async () => {
    expect(await t.hub.exists(code)).toEqual({ exists: true, status: 'open' });
    expect(await t.hub.exists('QQQQQQ')).toEqual({ exists: false, status: null });
  });
});
