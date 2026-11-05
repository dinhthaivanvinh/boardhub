import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { defaultAvatar } from '@bg/avatars/random';
import type { Avatar } from '@bg/avatars/schema';
import {
  commitment,
  DRAW_BUILD_UP_MS,
  DRAW_REVEAL_LEAD_MS,
  DRAW_START_DELAY_MS,
  drawWinners,
  normalizeCandidates,
  type ActivityContext,
  type AnyActivityDefinition,
  type DrawRequest,
  type Screen,
} from '@bg/office-core';
import {
  OFFICE_MAX_PARTICIPANTS,
  type OfficeDrawRecord,
  type OfficeDrawStarted,
  type OfficeHostOpInput,
  type OfficeParticipant,
  type OfficeSessionInfo,
  type OfficeSnapshot,
} from '@bg/protocol';
import { HubError } from '../errors';
import type { Logger } from '../hub/game-hub';
import type { JobScheduler } from '../hub/scheduler';
import type { OfficeRepo, OfficeSessionRecord, OfficeStore, RunningDraw } from './store';

/** Sessions close after this long without any activity (FR-SES-07). */
export const OFFICE_IDLE_MS = 24 * 60 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface OfficeActor {
  userId: string;
  name: string;
}

/** Pushes office changes to sockets: small diffs, never the whole session (NFR-OFF-02). */
export interface OfficeNotifier {
  participant(code: string, seq: number, participant: OfficeParticipant): void;
  removed(code: string, seq: number, id: string, reason: 'left' | 'kicked'): void;
  session(code: string, seq: number, session: OfficeSessionInfo): void;
  /** One view per screen; personal views (hidden information) come with later activities. */
  activity(code: string, seq: number, views: Record<Screen, unknown>): void;
  kicked(code: string, userId: string): void;
  drawStarted(code: string, seq: number, draw: OfficeDrawStarted): void;
  drawRevealed(code: string, seq: number, draw: OfficeDrawRecord): void;
}

export interface OfficeHubOptions {
  store: OfficeStore;
  repo: OfficeRepo;
  withLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
  jobs: JobScheduler;
  activities: Record<string, AnyActivityDefinition>;
  notifier: OfficeNotifier;
  log: Logger;
  now?: () => number;
  newCode?: () => string;
}

const sortById = (ps: OfficeParticipant[]) =>
  [...ps].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/**
 * Office sessions (docs/office/03 §4, skill office-realtime): who is in, who hosts, the activity's state.
 * Every change runs inside the session lock; the activity is only reached through its contract.
 */
export class OfficeHub {
  private readonly now: () => number;
  private readonly newCode: () => string;

  constructor(private readonly o: OfficeHubOptions) {
    this.now = o.now ?? Date.now;
    this.newCode =
      o.newCode ??
      (() => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(''));
  }

  // ---------- Commands ----------

  async create(
    actor: OfficeActor,
    input: { activityId: string; title: string; settings: Record<string, unknown> },
  ) {
    const activity = this.o.activities[input.activityId];
    if (!activity) throw new HubError('office.unknown_activity');
    const settings = activity.settingsSchema.safeParse(input.settings);
    if (!settings.success) throw new HubError('office.bad_settings');
    let code = this.newCode();
    for (let tries = 0; (await this.o.store.get(code)) && tries < 20; tries++) code = this.newCode();
    const now = this.now();
    const session: OfficeSessionRecord = {
      code,
      activityId: input.activityId,
      title: input.title,
      hostId: actor.userId,
      status: 'open',
      createdAt: now,
      lastActiveAt: now,
      seq: 1,
      participants: [],
      kicked: [],
      state: activity.setup(settings.data),
      draw: null,
      history: [],
    };
    await this.o.store.save(session);
    await this.o.jobs.schedule(`office-expire:${code}`, now + OFFICE_IDLE_MS, {
      kind: 'office-expire',
      code,
    });
    await this.o.repo
      .created({
        code,
        activityId: input.activityId,
        title: input.title,
        hostId: actor.userId,
        createdAt: now,
      })
      .catch((err: unknown) => this.o.log.error({ err, code }, 'office session not recorded'));
    return this.snapshot(session, actor.userId, 'host');
  }

  async join(
    actor: OfficeActor,
    input: { code: string; screen: Screen; name?: string | undefined; avatar?: Avatar | undefined },
  ) {
    return this.o.withLock(lockKey(input.code), async () => {
      const session = await this.load(input.code);
      if (session.status === 'closed') throw new HubError('office.closed');
      if (input.screen === 'host' && session.hostId !== actor.userId) throw new HubError('office.not_host');
      if (input.screen !== 'participant') return this.snapshot(session, actor.userId, input.screen);

      if (session.kicked.includes(actor.userId)) throw new HubError('office.locked');
      const existing = session.participants.find((p) => p.id === actor.userId);
      let changed: OfficeParticipant;
      if (existing) {
        changed = {
          ...existing,
          online: true,
          ...(input.name ? { name: input.name } : {}),
          ...(input.avatar ? { avatar: input.avatar } : {}),
        };
      } else {
        if (session.status === 'locked') throw new HubError('office.locked');
        if (session.participants.length >= this.limit(session)) throw new HubError('office.full');
        changed = {
          id: actor.userId,
          name: input.name ?? actor.name,
          avatar: input.avatar ?? defaultAvatar(actor.userId),
          online: true,
          joinedAt: this.now(),
          absent: false,
        };
      }
      const next = this.withParticipant(session, changed);
      await this.commit(next);
      this.o.notifier.participant(next.code, next.seq, changed);
      return this.snapshot(next, actor.userId, 'participant');
    });
  }

  async leave(actor: OfficeActor, code: string) {
    await this.o.withLock(lockKey(code), async () => {
      const session = await this.load(code);
      if (!session.participants.some((p) => p.id === actor.userId)) return;
      const next = this.without(session, actor.userId);
      await this.commit(next);
      this.o.notifier.removed(code, next.seq, actor.userId, 'left');
    });
  }

  async updateMe(
    actor: OfficeActor,
    input: { code: string; name?: string | undefined; avatar?: Avatar | undefined },
  ) {
    await this.o.withLock(lockKey(input.code), async () => {
      const session = await this.open(input.code);
      const me = session.participants.find((p) => p.id === actor.userId);
      if (!me) throw new HubError('office.not_participant');
      const changed = {
        ...me,
        ...(input.name ? { name: input.name } : {}),
        ...(input.avatar ? { avatar: input.avatar } : {}),
      };
      const next = this.withParticipant(session, changed);
      await this.commit(next);
      this.o.notifier.participant(next.code, next.seq, changed);
    });
  }

  async host(actor: OfficeActor, input: OfficeHostOpInput) {
    await this.o.withLock(lockKey(input.code), async () => {
      const session = await this.load(input.code.toUpperCase());
      if (session.hostId !== actor.userId) throw new HubError('office.not_host');
      if (session.status === 'closed') throw new HubError('office.closed');
      switch (input.op) {
        case 'lock':
        case 'unlock':
        case 'close': {
          const status = input.op === 'lock' ? 'locked' : input.op === 'unlock' ? 'open' : 'closed';
          const next = { ...session, status, seq: session.seq + 1 } as OfficeSessionRecord;
          await this.commit(next);
          this.o.notifier.session(next.code, next.seq, info(next));
          if (status === 'closed') await this.recordStatus(next.code, 'closed');
          return;
        }
        case 'kick': {
          const target = session.participants.find((p) => p.id === input.id);
          if (!target) return;
          const next = {
            ...this.without(session, input.id),
            kicked: target.absent ? session.kicked : [...session.kicked, input.id],
          };
          await this.commit(next);
          this.o.notifier.removed(next.code, next.seq, input.id, 'kicked');
          if (!target.absent) this.o.notifier.kicked(next.code, input.id);
          return;
        }
        case 'rename': {
          const target = session.participants.find((p) => p.id === input.id);
          if (!target) throw new HubError('office.not_participant');
          const changed = { ...target, name: input.name };
          const next = this.withParticipant(session, changed);
          await this.commit(next);
          this.o.notifier.participant(next.code, next.seq, changed);
          return;
        }
        case 'add-absent': {
          if (session.participants.length >= this.limit(session)) throw new HubError('office.full');
          const added: OfficeParticipant = {
            id: `absent:${randomUUID()}`,
            name: input.name,
            avatar: input.avatar,
            online: false,
            joinedAt: this.now(),
            absent: true,
          };
          const next = this.withParticipant(session, added);
          await this.commit(next);
          this.o.notifier.participant(next.code, next.seq, added);
          return;
        }
        case 'transfer': {
          const target = session.participants.find((p) => p.id === input.id);
          if (!target || target.absent) throw new HubError('office.not_participant');
          const next = { ...session, hostId: input.id, seq: session.seq + 1 };
          await this.commit(next);
          this.o.notifier.session(next.code, next.seq, info(next));
          return;
        }
      }
    });
  }

  /** An activity action (rule A3: parsed with the activity's own schema). */
  async action(actor: OfficeActor, code: string, raw: unknown) {
    await this.o.withLock(lockKey(code), async () => {
      const session = await this.open(code);
      const activity = this.activityOf(session);
      const parsed = activity.actionSchema.safeParse(raw);
      if (!parsed.success) throw new HubError('office.bad_action');
      const who = { id: actor.userId, isHost: session.hostId === actor.userId };
      const ctx = this.ctx(session);
      const check = activity.validate(session.state, who, parsed.data, ctx);
      if (!check.ok) throw new HubError(check.code);
      const { state, draw } = activity.apply(session.state, who, parsed.data, ctx);
      if (draw && session.draw && !session.draw.revealed) throw new HubError('office.draw_running');
      const next = { ...session, state, seq: session.seq + 1 };
      if (!draw) {
        await this.commit(next);
        this.o.notifier.activity(next.code, next.seq, this.views(next));
        return;
      }
      await this.startDraw(next, draw);
    });
  }

  async resync(actor: OfficeActor, code: string, screen: Screen) {
    const session = await this.load(code);
    return this.snapshot(session, actor.userId, screen);
  }

  /** The user's last participant screen for this session went away. */
  async disconnected(userId: string, code: string) {
    await this.o.withLock(lockKey(code), async () => {
      const session = await this.o.store.get(code);
      const me = session?.participants.find((p) => p.id === userId);
      if (!session || !me || !me.online) return;
      const changed = { ...me, online: false };
      // Going offline is not "activity": it does not keep the session alive.
      const next = { ...this.withParticipant(session, changed), lastActiveAt: session.lastActiveAt };
      await this.o.store.save(next);
      this.o.notifier.participant(next.code, next.seq, changed);
    });
  }

  /**
   * The fair draw (skill office-fair-draw): freeze the candidates, make a secret seed, fix the winners,
   * publish only the commitment. The reveal job publishes seed and winners just before the landing.
   */
  private async startDraw(session: OfficeSessionRecord, request: DrawRequest) {
    const ids = normalizeCandidates(request.candidates);
    const byId = new Map(session.participants.map((p) => [p.id, p]));
    const seed = randomBytes(32).toString('hex');
    const drawId = randomUUID();
    const startsAt = this.now() + DRAW_START_DELAY_MS;
    const draw: RunningDraw = {
      drawId,
      round: (session.history?.length ?? 0) + 1,
      mode: request.mode,
      n: request.n,
      candidates: ids.map((id) => {
        const p = byId.get(id);
        return { id, name: p?.name ?? '?', avatar: p!.avatar };
      }),
      commitment: commitment(seed),
      startsAt,
      revealAt: startsAt + DRAW_BUILD_UP_MS,
      seed,
      winners: drawWinners(seed, drawId, ids, request.n),
      revealed: false,
      revealedAt: null,
    };
    const next = { ...session, draw };
    await this.commit(next);
    this.o.notifier.drawStarted(next.code, next.seq, publicDraw(draw));
    await this.o.jobs.schedule(`office-reveal:${next.code}`, draw.revealAt - DRAW_REVEAL_LEAD_MS, {
      kind: 'office-reveal',
      code: next.code,
      drawId,
    });
  }

  /** Idempotent: a draw is revealed once, even if the job runs again (or the session was closed meanwhile). */
  private async reveal(code: string, drawId: string) {
    await this.o.withLock(lockKey(code), async () => {
      const session = await this.o.store.get(code);
      const draw = session?.draw;
      if (!session || !draw || draw.drawId !== drawId || draw.revealed) return;
      const activity = this.activityOf(session);
      const record: OfficeDrawRecord = {
        ...publicDraw(draw),
        seed: draw.seed,
        winners: draw.winners,
        revealedAt: this.now(),
      };
      const state = activity.onDrawResult(
        session.state,
        { drawId, mode: draw.mode, winners: draw.winners },
        this.ctx(session),
      );
      const next: OfficeSessionRecord = {
        ...session,
        state,
        draw: { ...draw, revealed: true, revealedAt: record.revealedAt },
        history: [record, ...(session.history ?? [])].slice(0, 50),
        seq: session.seq + 1,
      };
      await this.commit(next);
      this.o.notifier.drawRevealed(code, next.seq, record);
      const after = { ...next, seq: next.seq + 1 };
      await this.o.store.save(after);
      this.o.notifier.activity(code, after.seq, this.views(after));
      await this.o.repo
        .drawRevealed(code, record)
        .catch((err: unknown) => this.o.log.error({ err, code, drawId }, 'office draw not recorded'));
    });
  }

  /** A revealed draw for the verification page: from the live session, else from long-term storage. */
  async getDraw(code: string, drawId: string): Promise<OfficeDrawRecord | null> {
    const session = await this.o.store.get(code);
    const live = session?.history?.find((d) => d.drawId === drawId);
    return live ?? this.o.repo.getDraw(code, drawId);
  }

  /** Job entry point for office jobs. */
  runJob = async (
    job: { kind: 'office-expire'; code: string } | { kind: 'office-reveal'; code: string; drawId: string },
  ) => {
    if (job.kind === 'office-reveal') return this.reveal(job.code, job.drawId);
    return this.expire(job);
  };

  /** Idempotent: closes idle sessions, otherwise checks again when they could next expire. */
  private expire = async (job: { kind: 'office-expire'; code: string }) => {
    await this.o.withLock(lockKey(job.code), async () => {
      const session = await this.o.store.get(job.code);
      if (!session || session.status === 'closed') return;
      const due = session.lastActiveAt + OFFICE_IDLE_MS;
      if (this.now() < due) {
        await this.o.jobs.schedule(`office-expire:${job.code}`, due, job);
        return;
      }
      const next = { ...session, status: 'closed' as const, seq: session.seq + 1 };
      await this.o.store.save(next);
      this.o.notifier.session(next.code, next.seq, info(next));
      await this.recordStatus(next.code, 'closed');
    });
  };

  async exists(code: string) {
    const session = await this.o.store.get(code);
    return session ? { exists: true, status: session.status } : { exists: false, status: null };
  }

  // ---------- Helpers ----------

  private async load(code: string) {
    const session = await this.o.store.get(code);
    if (!session) throw new HubError('office.not_found');
    return session;
  }

  private async open(code: string) {
    const session = await this.load(code);
    if (session.status === 'closed') throw new HubError('office.closed');
    return session;
  }

  private activityOf(session: OfficeSessionRecord) {
    const activity = this.o.activities[session.activityId];
    if (!activity) throw new HubError('office.unknown_activity');
    return activity;
  }

  private limit(session: OfficeSessionRecord) {
    return Math.min(OFFICE_MAX_PARTICIPANTS, this.activityOf(session).meta.maxParticipants);
  }

  private withParticipant(session: OfficeSessionRecord, p: OfficeParticipant): OfficeSessionRecord {
    const others = session.participants.filter((x) => x.id !== p.id);
    return { ...session, participants: [...others, p], seq: session.seq + 1 };
  }

  private without(session: OfficeSessionRecord, id: string): OfficeSessionRecord {
    return {
      ...session,
      participants: session.participants.filter((p) => p.id !== id),
      seq: session.seq + 1,
    };
  }

  private async commit(session: OfficeSessionRecord) {
    session.lastActiveAt = this.now();
    await this.o.store.save(session);
  }

  private ctx(session: OfficeSessionRecord): ActivityContext {
    return { participants: sortById(session.participants), hostId: session.hostId, now: this.now() };
  }

  private views(session: OfficeSessionRecord): Record<Screen, unknown> {
    const activity = this.activityOf(session);
    const ctx = this.ctx(session);
    return {
      host: activity.view(session.state, 'host', null, ctx),
      stage: activity.view(session.state, 'stage', null, ctx),
      participant: activity.view(session.state, 'participant', null, ctx),
    };
  }

  private snapshot(session: OfficeSessionRecord, userId: string, screen: Screen): OfficeSnapshot {
    const activity = this.activityOf(session);
    return {
      ...info(session),
      seq: session.seq,
      serverTime: this.now(),
      me: {
        id: userId,
        isHost: session.hostId === userId,
        screen,
        joined: session.participants.some((p) => p.id === userId),
      },
      participants: [...session.participants].sort((a, b) => a.joinedAt - b.joinedAt),
      activity: activity.view(session.state, screen, userId, this.ctx(session)),
      draw: session.draw ? (session.draw.revealed ? recordOf(session.draw) : publicDraw(session.draw)) : null,
      history: session.history ?? [],
    };
  }

  private async recordStatus(code: string, status: 'closed') {
    await this.o.repo
      .statusChanged(code, status, this.now())
      .catch((err: unknown) => this.o.log.error({ err, code }, 'office status not recorded'));
  }
}

const lockKey = (code: string) => `office:${code.toUpperCase()}`;

/** What everyone may know while a draw runs: no seed, no winners. */
function publicDraw(d: RunningDraw): OfficeDrawStarted {
  return {
    drawId: d.drawId,
    round: d.round,
    mode: d.mode,
    n: d.n,
    candidates: d.candidates,
    commitment: d.commitment,
    startsAt: d.startsAt,
    revealAt: d.revealAt,
  };
}

function recordOf(d: RunningDraw): OfficeDrawRecord {
  return { ...publicDraw(d), seed: d.seed, winners: d.winners, revealedAt: d.revealedAt ?? d.revealAt };
}

function info(s: OfficeSessionRecord): OfficeSessionInfo {
  return { code: s.code, activityId: s.activityId, title: s.title, status: s.status, hostId: s.hostId };
}
