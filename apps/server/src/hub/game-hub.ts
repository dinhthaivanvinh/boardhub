import { randomInt, randomUUID } from 'node:crypto';
import {
  createRng,
  runMove,
  setupMatch,
  type AnyGameDefinition,
  type EliminationReason,
  type GameResult,
  type Seat,
} from '@bg/engine';
import type {
  BotLevel,
  ChatMessage,
  DisconnectPolicy,
  MatchActionType,
  MatchSnapshot,
  RoomJoined,
  RoomSnapshot,
  TimeControl,
} from '@bg/protocol';
import type { BotRunner } from '../bots/bot-runner';
import { clockDeadline, clocksAfterMove, clockViews, initClocks, stopClocks } from '../domain/clocks';
import type { Actor, MatchRecord, Room, UserOccupant } from '../domain/types';
import { HubError } from '../errors';
import type { LiveStore } from '../store/live-store';
import type { HistoryRepo } from '../store/repos';
import { maskProfanity } from './profanity';
import type { RatingService } from '../ratings/rating-service';
import type { Job, JobScheduler } from './scheduler';

export interface Notifier {
  roomUpdated(room: RoomSnapshot): void;
  /** Each seated user gets their own view; everyone else in the room gets the spectator view. */
  matchUpdated(update: {
    roomId: string;
    perUser: { userId: string; snapshot: MatchSnapshot }[];
    spectators: MatchSnapshot;
  }): void;
  chatMessage(message: ChatMessage): void;
}

export interface Logger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export interface HubOptions {
  store: LiveStore;
  history: HistoryRepo;
  games: Record<string, AnyGameDefinition>;
  bots: BotRunner;
  /** Timers (clocks, grace periods, bot turns). Redis-backed when running several processes. */
  jobs: JobScheduler;
  notifier: Notifier;
  log: Logger;
  /** Needed for ranked rooms; without it results never change ratings. */
  ratings?: RatingService;
  now?: () => number;
  newId?: () => string;
  newSeed?: () => string;
  newCode?: () => string;
  /** How long a disconnected player keeps their seat (FR-ROOM-04). */
  graceMs?: number;
  /** Pause before a bot moves, so its moves are visible (rule B7). */
  botDelayMs?: number;
}

export interface CreateRoomInput {
  gameId: string;
  config?: unknown;
  timeControl: TimeControl;
  disconnectPolicy: DisconnectPolicy;
  hostSeat: number | null;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
const CHAT_KEEP = 50;
const KEEP_MOVE_IDS = 50;
const BOT_TAKEOVER_LEVEL: BotLevel = 'medium';

export function randomRoomCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

/**
 * Rooms and matches (docs/05). Every change to a room or its match runs inside withLock(room id),
 * so moves, timers and bots never race each other, even across server processes.
 */
export class GameHub {
  private readonly now: () => number;
  private readonly newId: () => string;
  private readonly newSeed: () => string;
  private readonly newCode: () => string;
  private readonly graceMs: number;
  private readonly botDelayMs: number;

  constructor(private readonly o: HubOptions) {
    this.now = o.now ?? Date.now;
    this.newId = o.newId ?? randomUUID;
    this.newSeed = o.newSeed ?? randomUUID;
    this.newCode = o.newCode ?? randomRoomCode;
    this.graceMs = o.graceMs ?? 60_000;
    this.botDelayMs = o.botDelayMs ?? 400;
  }

  // ---------------------------------------------------------------- rooms

  async createRoom(actor: Actor, input: CreateRoomInput): Promise<RoomSnapshot> {
    const def = this.game(input.gameId);
    const config = def.configSchema.safeParse(input.config ?? {});
    if (!config.success) throw new HubError('invalid.payload', { field: 'config' });
    const seats: Room['seats'] = Array.from({ length: def.meta.maxPlayers }, () => null);
    if (input.hostSeat !== null) {
      if (input.hostSeat >= seats.length) throw new HubError('invalid.payload', { field: 'hostSeat' });
      seats[input.hostSeat] = this.occupant(actor);
    }
    const now = this.now();
    const room: Room = {
      id: this.newId(),
      code: await this.uniqueCode(),
      gameId: input.gameId,
      config: config.data as Record<string, unknown>,
      timeControl: input.timeControl,
      disconnectPolicy: input.disconnectPolicy,
      hostId: actor.userId,
      status: 'lobby',
      seats,
      spectators: input.hostSeat === null ? [actor.userId] : [],
      matchId: null,
      ranked: false,
      public: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.o.store.saveRoom(room);
    this.o.log.info({ roomId: room.id, gameId: room.gameId }, 'room created');
    return toRoomSnapshot(room);
  }

  async joinRoom(actor: Actor, code: string): Promise<RoomJoined> {
    const roomId = await this.o.store.roomIdByCode(code);
    if (!roomId) throw new HubError('room.not_found');
    return this.o.store.withLock(roomId, async () => {
      const room = await this.loadRoom(roomId);
      const seat = seatOf(room, actor.userId);
      if (seat >= 0) {
        const occ = room.seats[seat] as UserOccupant;
        Object.assign(occ, { connected: true, graceUntil: null, name: actor.name });
        await this.o.jobs.cancel(graceKey(room.id, actor.userId));
      } else if (!room.spectators.includes(actor.userId)) {
        room.spectators.push(actor.userId);
      }
      await this.saveRoom(room);
      const match = room.matchId ? await this.o.store.getMatch(room.matchId) : null;
      return {
        room: toRoomSnapshot(room),
        match: match ? this.snapshotFor(match, seat >= 0 ? seat : null) : null,
        chat: await this.o.store.getChat(room.id),
      };
    });
  }

  /** Leaving during a match keeps the seat for the grace period, like a disconnect. */
  async leaveRoom(actor: Actor, roomId: string): Promise<void> {
    await this.o.store.withLock(roomId, async () => {
      const room = await this.loadRoom(roomId);
      room.spectators = room.spectators.filter((id) => id !== actor.userId);
      const seat = seatOf(room, actor.userId);
      if (seat >= 0 && room.status === 'playing') {
        await this.markDisconnected(room, seat);
      } else if (seat >= 0) {
        room.seats[seat] = null;
      }
      if (room.hostId === actor.userId && room.status !== 'playing') this.passHost(room, actor.userId);
      await this.saveRoom(room);
    });
  }

  async takeSeat(actor: Actor, roomId: string, seat: number | null): Promise<void> {
    await this.mutateLobby(roomId, (room) => {
      const current = seatOf(room, actor.userId);
      if (seat === null) {
        if (current >= 0) room.seats[current] = null;
        if (!room.spectators.includes(actor.userId)) room.spectators.push(actor.userId);
        return;
      }
      if (seat >= room.seats.length) throw new HubError('invalid.payload', { field: 'seat' });
      if (room.seats[seat] && current !== seat) throw new HubError('room.seat_taken');
      if (current >= 0) room.seats[current] = null;
      room.seats[seat] = this.occupant(actor);
      room.spectators = room.spectators.filter((id) => id !== actor.userId);
    });
  }

  async setReady(actor: Actor, roomId: string, ready: boolean): Promise<void> {
    await this.mutateLobby(roomId, (room) => {
      const seat = seatOf(room, actor.userId);
      if (seat < 0) throw new HubError('room.not_seated');
      (room.seats[seat] as UserOccupant).ready = ready;
    });
  }

  async addBot(actor: Actor, roomId: string, seat: number, level: BotLevel): Promise<void> {
    await this.mutateLobby(roomId, (room) => {
      this.requireHost(room, actor);
      if (room.ranked) throw new HubError('room.invalid_state', { reason: 'ranked' });
      if (seat >= room.seats.length) throw new HubError('invalid.payload', { field: 'seat' });
      if (room.seats[seat]) throw new HubError('room.seat_taken');
      room.seats[seat] = { kind: 'bot', level };
    });
  }

  async removeBot(actor: Actor, roomId: string, seat: number): Promise<void> {
    await this.mutateLobby(roomId, (room) => {
      this.requireHost(room, actor);
      if (room.seats[seat]?.kind !== 'bot') throw new HubError('invalid.payload', { field: 'seat' });
      room.seats[seat] = null;
    });
  }

  async startMatch(actor: Actor, roomId: string): Promise<void> {
    await this.o.store.withLock(roomId, async () => {
      const room = await this.loadRoom(roomId);
      this.requireHost(room, actor);
      if (room.status !== 'lobby') throw new HubError('room.invalid_state');
      const def = this.game(room.gameId);
      const players =
        room.seats.findIndex((s) => s === null) === -1 ? room.seats.length : room.seats.indexOf(null);
      const gaps = room.seats.slice(players).some((s) => s !== null);
      if (gaps || players < def.meta.minPlayers) throw new HubError('room.not_ready', { reason: 'seats' });
      const unready = room.seats.some((s) => s?.kind === 'user' && s.userId !== actor.userId && !s.ready);
      if (unready) throw new HubError('room.not_ready', { reason: 'ready' });
      await this.beginMatch(room, players);
    });
  }

  /**
   * A room made by the matchmaker: both players seated and ready, ranked if asked, listed as live,
   * and the match starts right away. Seat order is as given (the matchmaker shuffles it).
   */
  async createMatchedRoom(
    players: { actor: Actor; rating: number }[],
    input: { gameId: string; timeControl: TimeControl; ranked: boolean },
  ): Promise<RoomSnapshot> {
    const def = this.game(input.gameId);
    if (players.length < def.meta.minPlayers || players.length > def.meta.maxPlayers) {
      throw new HubError('queue.unsupported');
    }
    const now = this.now();
    const room: Room = {
      id: this.newId(),
      code: await this.uniqueCode(),
      gameId: input.gameId,
      config: def.configSchema.parse({}) as Record<string, unknown>,
      timeControl: input.timeControl,
      disconnectPolicy: 'forfeit',
      hostId: players[0]!.actor.userId,
      status: 'lobby',
      seats: Array.from({ length: def.meta.maxPlayers }, (_, i) => {
        const p = players[i];
        return p ? { ...this.occupant(p.actor), ready: true, rating: p.rating } : null;
      }),
      spectators: [],
      matchId: null,
      ranked: input.ranked,
      public: true,
      createdAt: now,
      updatedAt: now,
    };
    await this.o.store.saveRoom(room);
    await this.o.store.withLock(room.id, async () => {
      const fresh = await this.loadRoom(room.id);
      await this.beginMatch(fresh, players.length);
      Object.assign(room, fresh);
    });
    this.o.log.info({ roomId: room.id, gameId: room.gameId, ranked: room.ranked }, 'matched room created');
    return toRoomSnapshot(room);
  }

  /** Starts a match in a room whose seats 0..players-1 are filled. Call inside the room lock. */
  private async beginMatch(room: Room, players: number): Promise<void> {
    const roomId = room.id;
    const def = this.game(room.gameId);
    const now = this.now();
    const seed = this.newSeed();
    const { state } = setupMatch(def, room.config, players, seed);
    const first = def.activePlayers(state)[0] ?? null;
    const match: MatchRecord = {
      id: this.newId(),
      roomId: room.id,
      gameId: room.gameId,
      rulesVersion: def.meta.rulesVersion,
      config: room.config,
      seed,
      players,
      state,
      seq: 0,
      moves: [],
      clocks: initClocks(room.timeControl, players, first, now),
      processedMoveIds: [],
      result: null,
      pendingOffer: null,
      startedAt: now,
      lastMoveAt: now,
    };
    room.status = 'playing';
    room.matchId = match.id;
    await this.o.store.saveMatch(match);
    await this.saveRoom(room);
    await this.history(() =>
      this.o.history.createMatch({
        id: match.id,
        roomCode: room.code,
        gameId: room.gameId,
        rulesVersion: match.rulesVersion,
        config: room.config,
        timeControl: room.timeControl,
        seed,
        startedAt: now,
        ranked: room.ranked,
        players: room.seats.slice(0, players).map((s, seat) => ({
          seat,
          userId: s?.kind === 'user' ? s.userId : null,
          botLevel: s?.kind === 'bot' ? s.level : null,
        })),
      }),
    );
    if (room.public) await this.o.store.setLive(room.id, true);
    this.o.log.info({ roomId, matchId: match.id }, 'match started');
    await this.afterMatchChange(room, match);
  }

  /** Back to the lobby with the same players; seats rotate so someone else moves first. */
  async rematch(actor: Actor, roomId: string): Promise<void> {
    await this.o.store.withLock(roomId, async () => {
      const room = await this.loadRoom(roomId);
      if (room.status !== 'finished') throw new HubError('room.invalid_state');
      if (seatOf(room, actor.userId) < 0 && room.hostId !== actor.userId)
        throw new HubError('room.not_seated');
      const used = room.seats.filter((s) => s !== null);
      const rotated = [...used.slice(1), ...used.slice(0, 1)];
      room.seats = room.seats.map((_, i) => {
        const s = rotated[i] ?? null;
        return s?.kind === 'user' ? { ...s, ready: false } : s;
      });
      room.status = 'lobby';
      room.matchId = null;
      await this.saveRoom(room);
    });
  }

  async chat(actor: Actor, roomId: string, text: string): Promise<void> {
    const room = await this.loadRoom(roomId);
    if (seatOf(room, actor.userId) < 0 && !room.spectators.includes(actor.userId)) {
      throw new HubError('room.not_found');
    }
    const message: ChatMessage = {
      id: this.newId(),
      roomId,
      from: { userId: actor.userId, name: actor.name },
      text: maskProfanity(text),
      at: this.now(),
    };
    await this.o.store.appendChat(message, CHAT_KEEP);
    this.o.notifier.chatMessage(message);
  }

  /** Called when a user's last connection to the room drops. */
  async disconnected(userId: string, roomId: string): Promise<void> {
    await this.o.store.withLock(roomId, async () => {
      const room = await this.o.store.getRoom(roomId);
      if (!room) return;
      const seat = seatOf(room, userId);
      if (seat < 0) {
        room.spectators = room.spectators.filter((id) => id !== userId);
      } else {
        await this.markDisconnected(room, seat);
      }
      await this.saveRoom(room);
    });
  }

  // ---------------------------------------------------------------- matches

  async submitMove(
    actor: Actor,
    input: { matchId: string; seq: number; clientMoveId: string; move: unknown },
  ): Promise<{ seq: number }> {
    const roomId = await this.roomIdOfMatch(input.matchId);
    return this.o.store.withLock(roomId, async () => {
      const room = await this.loadRoom(roomId);
      const match = await this.loadMatch(input.matchId);
      const seat = seatOf(room, actor.userId);
      if (seat < 0 || seat >= match.players) throw new HubError('match.not_player');
      if (match.processedMoveIds.includes(input.clientMoveId)) return { seq: match.seq };
      if (match.result) throw new HubError('engine.game_over');
      if (this.applyTimeout(room, match)) {
        await this.commit(room, match);
        throw new HubError('engine.game_over');
      }
      if (input.seq !== match.seq) throw new HubError('match.stale_seq', { seq: match.seq });
      await this.applyMove(room, match, seat, input.move, input.clientMoveId);
      return { seq: match.seq };
    });
  }

  async matchAction(actor: Actor, matchId: string, action: MatchActionType): Promise<void> {
    const roomId = await this.roomIdOfMatch(matchId);
    await this.o.store.withLock(roomId, async () => {
      const room = await this.loadRoom(roomId);
      const match = await this.loadMatch(matchId);
      const seat = seatOf(room, actor.userId);
      if (seat < 0 || seat >= match.players) throw new HubError('match.not_player');
      if (match.result) throw new HubError('engine.game_over');
      if (this.applyTimeout(room, match)) {
        await this.commit(room, match);
        throw new HubError('engine.game_over');
      }

      if (action === 'resign') {
        this.eliminate(room, match, seat, 'resign');
      } else if (action === 'offer-draw') {
        match.pendingOffer = { type: 'draw', from: seat };
      } else {
        if (!match.pendingOffer || match.pendingOffer.from === seat) throw new HubError('match.no_offer');
        if (action === 'accept-draw') this.finish(room, match, { kind: 'draw', reason: 'agreement' });
        match.pendingOffer = null;
      }
      match.seq++;
      await this.commit(room, match);
    });
  }

  async resync(actor: Actor, matchId: string): Promise<MatchSnapshot> {
    const match = await this.loadMatch(matchId);
    const room = await this.loadRoom(match.roomId);
    const seat = seatOf(room, actor.userId);
    if (seat < 0 && !room.spectators.includes(actor.userId)) throw new HubError('room.not_found');
    return this.snapshotFor(match, seat >= 0 && seat < match.players ? seat : null);
  }

  snapshotFor(match: MatchRecord, seat: Seat | null): MatchSnapshot {
    const def = this.game(match.gameId);
    const now = this.now();
    return {
      matchId: match.id,
      roomId: match.roomId,
      gameId: match.gameId,
      rulesVersion: match.rulesVersion,
      seq: match.seq,
      moveCount: match.moves.length,
      view: def.playerView(match.state, seat ?? 'spectator'),
      mySeat: seat,
      activeSeats: match.result ? [] : def.activePlayers(match.state),
      clocks: clockViews(match.clocks, now),
      serverTime: now,
      result: match.result,
      pendingOffer: match.pendingOffer,
      ratingChanges: match.ratingChanges ?? null,
    };
  }

  // ---------------------------------------------------------------- internals

  /** Applies a move inside the room lock. Throws HubError with the engine code if illegal. */
  private async applyMove(
    room: Room,
    match: MatchRecord,
    seat: Seat,
    move: unknown,
    clientMoveId: string | null,
  ) {
    const def = this.game(match.gameId);
    const index = match.moves.length;
    const res = runMove(def, match.state, seat, move, { rng: createRng(match.seed, index) });
    if (!res.ok) throw new HubError(res.code, res.params);

    const now = this.now();
    const elapsedMs = now - match.lastMoveAt;
    match.state = res.state;
    match.moves.push({ seat, move, at: now });
    match.seq++;
    match.lastMoveAt = now;
    match.pendingOffer = null;
    if (clientMoveId)
      match.processedMoveIds = [...match.processedMoveIds, clientMoveId].slice(-KEEP_MOVE_IDS);
    if (match.clocks) {
      const next = res.result ? null : (def.activePlayers(res.state)[0] ?? null);
      match.clocks = clocksAfterMove(room.timeControl, match.clocks, seat, next, now);
    }
    if (res.result) this.finish(room, match, res.result);

    await this.history(() => this.o.history.addMove(match.id, index, seat, move, elapsedMs, now));
    await this.commit(room, match);
  }

  /** Saves room and match, records the result if the match just ended, notifies and schedules follow-ups. */
  private async commit(room: Room, match: MatchRecord) {
    if (match.result && room.ranked && !match.ratingChanges) await this.applyRatings(room, match);
    await this.o.store.saveMatch(match);
    await this.saveRoom(room);
    if (match.result) {
      const result = match.result;
      await this.history(() => this.o.history.finishMatch(match.id, result, this.now()));
      this.o.log.info({ roomId: room.id, matchId: match.id, result }, 'match finished');
      if (room.public) await this.o.store.setLive(room.id, false);
    }
    await this.afterMatchChange(room, match);
  }

  /** Runs a due job. Every branch re-checks the current state, so running a job twice is harmless. */
  runJob = async (job: Job): Promise<void> => {
    switch (job.kind) {
      case 'clock':
        return this.onClockTimer(job.roomId, job.matchId);
      case 'grace':
        return this.onGraceExpired(job.roomId, job.userId);
      case 'bot':
        return this.runBotTurn(job.roomId, job.matchId, job.seq);
    }
  };

  private async afterMatchChange(room: Room, match: MatchRecord) {
    const perUser = room.seats.flatMap((s, seat) =>
      s?.kind === 'user' && seat < match.players
        ? [{ userId: s.userId, snapshot: this.snapshotFor(match, seat) }]
        : [],
    );
    this.o.notifier.matchUpdated({ roomId: room.id, perUser, spectators: this.snapshotFor(match, null) });

    const clockKey = `clock:${match.id}`;
    const botKey = `bot:${match.id}`;
    if (match.result) {
      await this.o.jobs.cancel(clockKey);
      await this.o.jobs.cancel(botKey);
      return;
    }
    const deadline = clockDeadline(match.clocks);
    if (deadline === null) await this.o.jobs.cancel(clockKey);
    else
      await this.o.jobs.schedule(clockKey, deadline, { kind: 'clock', roomId: room.id, matchId: match.id });

    const active = this.game(match.gameId).activePlayers(match.state)[0];
    const occ = active === undefined ? null : room.seats[active];
    if (occ?.kind === 'bot' && active !== undefined) {
      await this.o.jobs.schedule(botKey, this.now() + this.botDelayMs, {
        kind: 'bot',
        roomId: room.id,
        matchId: match.id,
        seq: match.seq,
      });
    } else {
      await this.o.jobs.cancel(botKey);
    }
  }

  private async runBotTurn(roomId: string, matchId: string, seq: number) {
    const match = await this.o.store.getMatch(matchId);
    const room = await this.o.store.getRoom(roomId);
    if (!match || !room || match.result || match.seq !== seq) return;
    const def = this.game(match.gameId);
    const seat = def.activePlayers(match.state)[0];
    const occ = seat === undefined ? null : room.seats[seat];
    if (seat === undefined || occ?.kind !== 'bot') return;

    let move: unknown;
    try {
      move = await this.o.bots.choose({
        gameId: match.gameId,
        view: def.playerView(match.state, seat),
        seat,
        level: occ.level,
        seed: match.seed,
        moveIndex: match.moves.length,
      });
    } catch (err) {
      this.o.log.error({ err, matchId }, 'bot failed, playing a random move');
      move = randomLegal(def, match.state, seat, match.seed, match.moves.length);
    }

    await this.o.store.withLock(roomId, async () => {
      const fresh = await this.o.store.getMatch(matchId);
      const freshRoom = await this.o.store.getRoom(roomId);
      // The position changed while the bot was thinking (resign, timeout, takeover): drop the move.
      if (!fresh || !freshRoom || fresh.result || fresh.seq !== seq) return;
      if (this.applyTimeout(freshRoom, fresh)) return this.commit(freshRoom, fresh);
      try {
        await this.applyMove(freshRoom, fresh, seat, move, null);
      } catch (err) {
        this.o.log.error({ err, matchId, move }, 'bot move rejected, playing a random move');
        await this.applyMove(
          freshRoom,
          fresh,
          seat,
          randomLegal(def, fresh.state, seat, fresh.seed, fresh.moves.length),
          null,
        );
      }
    });
  }

  private async onClockTimer(roomId: string, matchId: string) {
    await this.o.store.withLock(roomId, async () => {
      const room = await this.o.store.getRoom(roomId);
      const match = await this.o.store.getMatch(matchId);
      if (!room || !match || match.result) return;
      if (this.applyTimeout(room, match)) await this.commit(room, match);
    });
  }

  private async onGraceExpired(roomId: string, userId: string) {
    await this.o.store.withLock(roomId, async () => {
      const room = await this.o.store.getRoom(roomId);
      if (!room) return;
      const seat = seatOf(room, userId);
      const occ = seat >= 0 ? (room.seats[seat] as UserOccupant) : null;
      if (!occ || occ.connected || (occ.graceUntil ?? 0) > this.now()) return;

      if (room.status !== 'playing' || !room.matchId) {
        room.seats[seat] = null;
        if (room.hostId === userId) this.passHost(room, userId);
        await this.saveRoom(room);
        return;
      }
      const match = await this.loadMatch(room.matchId);
      if (room.disconnectPolicy === 'bot') {
        room.seats[seat] = { kind: 'bot', level: BOT_TAKEOVER_LEVEL };
        match.seq++;
      } else {
        this.eliminate(room, match, seat, 'abandon');
        match.seq++;
      }
      this.o.log.info({ roomId, userId, policy: room.disconnectPolicy }, 'grace period expired');
      await this.commit(room, match);
    });
  }

  /** If the running clock has run out, ends the match on time. Returns true if it did. */
  private applyTimeout(room: Room, match: MatchRecord): boolean {
    const deadline = clockDeadline(match.clocks);
    if (deadline === null || this.now() < deadline || match.clocks?.runningSeat == null) return false;
    this.eliminate(room, match, match.clocks.runningSeat, 'timeout');
    match.seq++;
    return true;
  }

  private eliminate(room: Room, match: MatchRecord, seat: Seat, reason: EliminationReason) {
    const def = this.game(match.gameId);
    if (def.onPlayerEliminated) {
      match.state = def.onPlayerEliminated(match.state, seat, reason);
      const result = def.result(match.state);
      if (result) this.finish(room, match, result);
      return;
    }
    const winners = Array.from({ length: match.players }, (_, s) => s).filter((s) => s !== seat);
    this.finish(room, match, { kind: 'win', winners, reason });
  }

  private finish(room: Room, match: MatchRecord, result: GameResult) {
    match.result = result;
    match.pendingOffer = null;
    if (match.clocks) match.clocks = stopClocks(match.clocks, this.now());
    room.status = 'finished';
  }

  /** Ranked two-player games: update both ratings once, record the change on the match and in history. */
  private async applyRatings(room: Room, match: MatchRecord) {
    const result = match.result;
    const ids = room.seats.slice(0, match.players).map((s) => (s?.kind === 'user' ? s.userId : null));
    const [a, b] = ids;
    if (!result || !this.o.ratings || match.players !== 2 || !a || !b) return;
    try {
      const changes = await this.o.ratings.applyResult(match.gameId, [a, b], result);
      match.ratingChanges = changes;
      // Show the new ratings in the room (for a rematch).
      for (const c of changes) {
        const occ = room.seats[c.seat];
        if (occ?.kind === 'user') occ.rating = c.after;
      }
      await this.history(() => this.o.history.setRatingChanges(match.id, changes));
    } catch (err) {
      this.o.log.error({ err, matchId: match.id }, 'failed to update ratings');
    }
  }

  private async markDisconnected(room: Room, seat: number) {
    const occ = room.seats[seat] as UserOccupant;
    occ.connected = false;
    occ.graceUntil = this.now() + this.graceMs;
    await this.o.jobs.schedule(graceKey(room.id, occ.userId), occ.graceUntil, {
      kind: 'grace',
      roomId: room.id,
      userId: occ.userId,
    });
  }

  private passHost(room: Room, leaving: string) {
    const seated = room.seats.find((s): s is UserOccupant => s?.kind === 'user' && s.userId !== leaving);
    const next = seated?.userId ?? room.spectators.find((id) => id !== leaving);
    if (next) room.hostId = next;
  }

  private async mutateLobby(roomId: string, fn: (room: Room) => void) {
    await this.o.store.withLock(roomId, async () => {
      const room = await this.loadRoom(roomId);
      if (room.status !== 'lobby') throw new HubError('room.invalid_state');
      fn(room);
      await this.saveRoom(room);
    });
  }

  private async saveRoom(room: Room) {
    room.updatedAt = this.now();
    await this.o.store.saveRoom(room);
    this.o.notifier.roomUpdated(toRoomSnapshot(room));
  }

  private requireHost(room: Room, actor: Actor) {
    if (room.hostId !== actor.userId) throw new HubError('room.not_host');
  }

  private occupant(actor: Actor): UserOccupant {
    return {
      kind: 'user',
      userId: actor.userId,
      name: actor.name,
      ready: false,
      connected: true,
      graceUntil: null,
    };
  }

  private game(gameId: string): AnyGameDefinition {
    const def = this.o.games[gameId];
    if (!def) throw new HubError('game.not_found');
    return def;
  }

  private async loadRoom(id: string): Promise<Room> {
    const room = await this.o.store.getRoom(id);
    if (!room) throw new HubError('room.not_found');
    return room;
  }

  private async loadMatch(id: string): Promise<MatchRecord> {
    const match = await this.o.store.getMatch(id);
    if (!match) throw new HubError('match.not_found');
    return match;
  }

  private async roomIdOfMatch(matchId: string): Promise<string> {
    return (await this.loadMatch(matchId)).roomId;
  }

  private async uniqueCode(): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const code = this.newCode();
      if (!(await this.o.store.roomIdByCode(code))) return code;
    }
    throw new Error('could not find a free room code');
  }

  /** History is best effort: a database hiccup must not break a live match. */
  private async history(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      this.o.log.error({ err }, 'failed to write match history');
    }
  }
}

function seatOf(room: Room, userId: string): number {
  return room.seats.findIndex((s) => s?.kind === 'user' && s.userId === userId);
}

function graceKey(roomId: string, userId: string) {
  return `grace:${roomId}:${userId}`;
}

function randomLegal(
  def: AnyGameDefinition,
  state: unknown,
  seat: Seat,
  seed: string,
  index: number,
): unknown {
  const legal = def.legalMoves?.(state, seat) ?? [];
  return legal[createRng(`fallback:${seed}`, index).int(0, Math.max(1, legal.length))];
}

export function toRoomSnapshot(room: Room): RoomSnapshot {
  return {
    id: room.id,
    code: room.code,
    gameId: room.gameId,
    config: room.config,
    timeControl: room.timeControl,
    disconnectPolicy: room.disconnectPolicy,
    hostId: room.hostId,
    status: room.status,
    seats: room.seats,
    spectatorCount: room.spectators.length,
    matchId: room.matchId,
    ranked: room.ranked,
    public: room.public,
  };
}
