import type { Namespace, Socket } from 'socket.io';
import type { z } from 'zod';
import type { Screen } from '@bg/office-core';
import {
  OfficeAction,
  OfficeCreate,
  OfficeHostOp,
  OfficeJoin,
  OfficeReact,
  OfficeRef,
  OfficeUpdateMe,
  PROTOCOL_VERSION,
  type Ack,
  type HandshakeAuth,
  type OfficeClientToServerEvents,
  type OfficeServerToClientEvents,
} from '@bg/protocol';
import type { AuthService } from '../auth/auth-service';
import { HubError } from '../errors';
import type { Logger } from '../hub/game-hub';
import { RateLimiter } from '../realtime/rate-limit';
import type { OfficeActor, OfficeHub, OfficeNotifier } from './office-hub';

interface SocketData {
  actor: OfficeActor;
  /** The screen this socket shows, per session code. */
  screens: Record<string, Screen>;
}

export type OfficeNamespace = Namespace<
  OfficeClientToServerEvents,
  OfficeServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type OfficeSocket = Socket<
  OfficeClientToServerEvents,
  OfficeServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const all = (code: string) => `office:${code}`;
const screenChannel = (code: string, screen: Screen) => `office:${code}:${screen}`;
const user = (userId: string) => `office-user:${userId}`;
const SCREENS: Screen[] = ['host', 'stage', 'participant'];

export function createOfficeNotifier(ns: OfficeNamespace): OfficeNotifier {
  return {
    participant: (code, seq, participant) =>
      void ns.to(all(code)).emit('office:participant', { code, seq, participant }),
    removed: (code, seq, id, reason) =>
      void ns.to(all(code)).emit('office:participant-removed', { code, seq, id, reason }),
    session: (code, seq, session) => void ns.to(all(code)).emit('office:session', { code, seq, session }),
    activity(code, seq, views) {
      for (const screen of SCREENS)
        ns.to(screenChannel(code, screen)).emit('office:activity', { code, seq, view: views[screen] });
    },
    drawStarted: (code, seq, draw) => void ns.to(all(code)).emit('office:draw-started', { code, seq, draw }),
    drawRevealed: (code, seq, draw) =>
      void ns.to(all(code)).emit('office:draw-revealed', { code, seq, draw }),
    kicked(code, userId) {
      ns.to(user(userId)).emit('office:kicked', { code });
      // Their sockets stop receiving the session (works across servers through the Redis adapter).
      ns.in(user(userId)).socketsLeave([all(code), ...SCREENS.map((s) => screenChannel(code, s))]);
    },
  };
}

/** Socket.IO namespace "/office": auth, rate limit, zod, ack — same rules as the board game gateway. */
export function attachOfficeGateway(ns: OfficeNamespace, hub: OfficeHub, auth: AuthService, log: Logger) {
  ns.use(async (socket, next) => {
    const { token, protocolVersion } = (socket.handshake.auth ?? {}) as Partial<HandshakeAuth>;
    if (protocolVersion !== PROTOCOL_VERSION) return next(new Error('protocol.version'));
    let found;
    try {
      found = await auth.authenticate(token);
    } catch (err) {
      // A banned account gets its own code, so the page can say why.
      return next(new Error(err instanceof HubError ? err.code : 'auth.required'));
    }
    if (!found) return next(new Error('auth.required'));
    socket.data.actor = { userId: found.id, name: found.displayName };
    socket.data.screens = {};
    next();
  });

  ns.on('connection', (socket: OfficeSocket) => {
    const { actor } = socket.data;
    void socket.join(user(actor.userId));
    const limiter = new RateLimiter();
    // Reactions are fun, not spam: at most 3 per 2 seconds per socket (docs/office/06 §1).
    const reactions = new RateLimiter(3, 2_000);

    const on = <S extends z.ZodType, R>(
      event: keyof OfficeClientToServerEvents,
      schema: S,
      handler: (input: z.output<S>) => Promise<R>,
    ) => {
      socket.on(event, async (payload: unknown, ack: unknown) => {
        if (typeof ack !== 'function') return;
        const reply = ack as (res: Ack<R | Record<string, never>>) => void;
        if (!limiter.allow()) return reply({ ok: false, code: 'rate.limited' });
        const parsed = schema.safeParse(payload);
        if (!parsed.success) return reply({ ok: false, code: 'invalid.payload' });
        try {
          const data = await handler(parsed.data);
          reply({ ok: true, data: data ?? {} });
        } catch (err) {
          if (err instanceof HubError) return reply({ ok: false, code: err.code });
          log.error({ err, event, userId: actor.userId }, 'office handler failed');
          reply({ ok: false, code: 'internal' });
        }
      });
    };

    const watch = async (code: string, screen: Screen) => {
      const previous = socket.data.screens[code];
      if (previous && previous !== screen) await socket.leave(screenChannel(code, previous));
      socket.data.screens[code] = screen;
      await socket.join([all(code), screenChannel(code, screen)]);
    };

    on('office:create', OfficeCreate, async (input) => {
      const session = await hub.create(actor, input);
      await watch(session.code, 'host');
      return { session };
    });
    on('office:join', OfficeJoin, async (input) => {
      const session = await hub.join(actor, input);
      await watch(session.code, input.screen);
      return { session };
    });
    on('office:leave', OfficeRef, async ({ code }) => {
      await hub.leave(actor, code);
    });
    on('office:update-me', OfficeUpdateMe, (input) => hub.updateMe(actor, input));
    on('office:host', OfficeHostOp, (input) => hub.host(actor, input));
    on('office:action', OfficeAction, ({ code, action }) => hub.action(actor, code, action));
    on('office:resync', OfficeRef, async ({ code }) => ({
      session: await hub.resync(actor, code, socket.data.screens[code] ?? 'stage'),
    }));

    on('office:react', OfficeReact, async ({ code, emoji }) => {
      // Only someone who joined this session from their phone can react.
      if (socket.data.screens[code] !== 'participant') throw new HubError('office.not_participant');
      if (!reactions.allow()) throw new HubError('rate.limited');
      ns.to([screenChannel(code, 'stage'), screenChannel(code, 'host')]).emit('office:reaction', {
        code,
        from: actor.userId,
        emoji,
      });
    });

    // When the user's last participant screen of a session goes away, they show as offline.
    socket.on('disconnecting', () => {
      const codes = Object.entries(socket.data.screens)
        .filter(([, screen]) => screen === 'participant')
        .map(([code]) => code);
      if (codes.length === 0) return;
      void (async () => {
        const others = await ns.in(user(actor.userId)).fetchSockets();
        for (const code of codes) {
          const stillThere = others.some(
            (s) => s.id !== socket.id && s.rooms.has(screenChannel(code, 'participant')),
          );
          if (!stillThere) await hub.disconnected(actor.userId, code);
        }
      })().catch((err: unknown) => log.error({ err, userId: actor.userId }, 'office disconnect failed'));
    });
  });
}
