import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import {
  PROTOCOL_VERSION,
  type Ack,
  type AuthResponse,
  type OfficeClientToServerEvents,
  type OfficeServerToClientEvents,
  type OfficeSnapshot,
} from '@bg/protocol';
import { buildServer } from '../src/app';
import { loadConfig } from '../src/config';

type Client = Socket<OfficeServerToClientEvents, OfficeClientToServerEvents>;

let server: Awaited<ReturnType<typeof buildServer>>;
let url: string;
const sockets: Client[] = [];

beforeAll(async () => {
  server = await buildServer(loadConfig({ LOG_LEVEL: 'silent', BOT_WORKERS: '0' }));
  await server.app.listen({ port: 0, host: '127.0.0.1' });
  const address = server.app.server.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  url = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  for (const s of sockets) s.disconnect();
  await server.close();
});

async function guest(name: string): Promise<AuthResponse> {
  const res = await server.app.inject({
    method: 'POST',
    url: '/api/auth/guest',
    payload: { displayName: name },
  });
  return res.json() as AuthResponse;
}

function open(token: string): Promise<Client> {
  const socket: Client = connect(`${url}/office`, {
    auth: { token, protocolVersion: PROTOCOL_VERSION },
    transports: ['websocket'],
    reconnection: false,
  });
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function emit<R>(socket: Client, event: keyof OfficeClientToServerEvents, payload: unknown): Promise<Ack<R>> {
  return new Promise((resolve) =>
    (socket.emit as (e: string, p: unknown, ack: (r: Ack<R>) => void) => void)(event, payload, resolve),
  );
}

async function ok<R>(socket: Client, event: keyof OfficeClientToServerEvents, payload: unknown): Promise<R> {
  const res = await emit<R>(socket, event, payload);
  if (!res.ok) throw new Error(`${event} failed: ${res.code}`);
  return res.data;
}

function next<E extends keyof OfficeServerToClientEvents>(
  socket: Client,
  event: E,
  predicate: (arg: Parameters<OfficeServerToClientEvents[E]>[0]) => boolean = () => true,
): Promise<Parameters<OfficeServerToClientEvents[E]>[0]> {
  return new Promise((resolve) => {
    const handler = (arg: Parameters<OfficeServerToClientEvents[E]>[0]) => {
      if (!predicate(arg)) return;
      (socket.off as (e: string, h: unknown) => void)(event, handler);
      resolve(arg);
    };
    (socket.on as (e: string, h: unknown) => void)(event, handler);
  });
}

describe('office namespace', () => {
  it('needs a valid token', async () => {
    await expect(open('garbage')).rejects.toThrow('auth.required');
  });

  it('host, stage and a participant: the participant appears as one small event', async () => {
    const host = await open((await guest('Host')).token);
    const created = await ok<{ session: OfficeSnapshot }>(host, 'office:create', {
      activityId: 'lucky-animal',
      title: 'Ai mua trà sữa?',
    });
    const { code } = created.session;
    expect(code).toMatch(/^[A-Z0-9]{6}$/);

    const stage = await open((await guest('Projector')).token);
    await ok(stage, 'office:join', { code, screen: 'stage' });

    const an = await guest('An');
    const phone = await open(an.token);
    const seenByStage = next(stage, 'office:participant');
    const seenByHost = next(host, 'office:participant');
    const joined = await ok<{ session: OfficeSnapshot }>(phone, 'office:join', {
      code: code.toLowerCase(),
      screen: 'participant',
    });
    expect(joined.session.me).toMatchObject({ joined: true, isHost: false });
    expect((await seenByStage).participant).toMatchObject({ id: an.user.id, name: 'An', online: true });
    await seenByHost;

    // Leaving the page: the participant shows as offline.
    const offline = next(host, 'office:participant', (e) => !e.participant.online);
    phone.disconnect();
    expect((await offline).participant.id).toBe(an.user.id);
  });

  it('kicked participants are told and stop receiving the session', async () => {
    const host = await open((await guest('Host')).token);
    const { session } = await ok<{ session: OfficeSnapshot }>(host, 'office:create', {
      activityId: 'lucky-animal',
    });
    const binh = await guest('Bình');
    const phone = await open(binh.token);
    await ok(phone, 'office:join', { code: session.code, screen: 'participant' });

    const kicked = next(phone, 'office:kicked');
    await ok(host, 'office:host', { code: session.code, op: 'kick', id: binh.user.id });
    expect(await kicked).toEqual({ code: session.code });
    const res = await emit(phone, 'office:join', { code: session.code, screen: 'participant' });
    expect(res).toEqual({ ok: false, code: 'office.locked' });

    // Not the host: refused.
    expect(await emit(phone, 'office:host', { code: session.code, op: 'lock' })).toEqual({
      ok: false,
      code: 'office.not_host',
    });
    // Bad payloads never reach the hub.
    expect(await emit(phone, 'office:join', { code: 'bad', screen: 'participant' })).toEqual({
      ok: false,
      code: 'invalid.payload',
    });
  });

  it('the portal can check a code over REST', async () => {
    const host = await open((await guest('Host')).token);
    const { session } = await ok<{ session: OfficeSnapshot }>(host, 'office:create', {
      activityId: 'lucky-animal',
    });
    const hit = await server.app.inject({ method: 'GET', url: `/api/office/${session.code}` });
    expect(hit.json()).toEqual({ exists: true, status: 'open' });
    const miss = await server.app.inject({ method: 'GET', url: '/api/office/QQQQQQ' });
    expect(miss.json()).toEqual({ exists: false, status: null });
    const bad = await server.app.inject({ method: 'GET', url: '/api/office/nope' });
    expect(bad.json()).toEqual({ exists: false, status: null });
  });
});
