'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AvatarData } from '@bg/avatars';
import type {
  OfficeHostOpInput,
  OfficeParticipant,
  OfficeScreen,
  OfficeSessionInfo,
  OfficeSnapshot,
} from '@bg/protocol';
import { getOfficeSocket, officeRequest, type OfficeSocket } from './office-socket';

/** A host operation without the session code (Omit applied to each variant). */
export type HostOp = OfficeHostOpInput extends infer T
  ? T extends unknown
    ? Omit<T, 'code'>
    : never
  : never;

export type OfficeConnection = 'connecting' | 'online' | 'offline';

export interface OfficeSessionApi {
  session: OfficeSnapshot | null;
  /** Error code while joining (e.g. office.not_found, office.locked). */
  joinError: string | null;
  kicked: boolean;
  connection: OfficeConnection;
  /** Server time minus local time (ms), for timed animations. */
  serverOffset: number;
  /** For participants: join with this name/animal (call again to come back after leaving). */
  join(input?: { name?: string; avatar?: AvatarData }): Promise<string | null>;
  updateMe(input: { name?: string; avatar?: AvatarData }): Promise<string | null>;
  host(op: HostOp): Promise<string | null>;
  action(action: unknown): Promise<string | null>;
  leave(): Promise<void>;
}

const byJoin = (a: OfficeParticipant, b: OfficeParticipant) => a.joinedAt - b.joinedAt;

/**
 * Keeps one office session in sync on one screen (docs/office/03 §4): a full snapshot when joining,
 * then small events applied in `seq` order; a gap means we missed something, so we resync.
 * `autoJoin` joins at once (host and stage screens); participants join when they press the button.
 */
export function useOfficeSession(code: string, screen: OfficeScreen, autoJoin: boolean): OfficeSessionApi {
  const [session, setSession] = useState<OfficeSnapshot | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  const [connection, setConnection] = useState<OfficeConnection>('connecting');
  const [serverOffset, setServerOffset] = useState(0);
  const socketRef = useRef<OfficeSocket | null>(null);
  const joinedWith = useRef<{ name?: string; avatar?: AvatarData } | null>(autoJoin ? {} : null);
  const seq = useRef(0);

  const accept = useCallback((snapshot: OfficeSnapshot) => {
    seq.current = snapshot.seq;
    setServerOffset(snapshot.serverTime - Date.now());
    setSession({ ...snapshot, participants: [...snapshot.participants].sort(byJoin) });
  }, []);

  const doJoin = useCallback(
    async (input: { name?: string; avatar?: AvatarData }) => {
      const s = socketRef.current ?? (await getOfficeSocket());
      const res = await officeRequest<{ session: OfficeSnapshot }>(s, 'office:join', {
        code,
        screen,
        ...input,
      });
      if (!res.ok) {
        setJoinError(res.code);
        return res.code;
      }
      setJoinError(null);
      joinedWith.current = input;
      accept(res.data.session);
      return null;
    },
    [accept, code, screen],
  );

  const resync = useCallback(async () => {
    const s = socketRef.current;
    if (!s) return;
    const res = await officeRequest<{ session: OfficeSnapshot }>(s, 'office:resync', { code });
    if (res.ok) accept(res.data.session);
  }, [accept, code]);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    void getOfficeSocket().then((s) => {
      if (cancelled) return;
      socketRef.current = s;
      const mine = (e: { code: string }) => e.code === code;
      /** Applies an event only if it is the next one; otherwise resync. */
      const step = (e: { code: string; seq: number }, apply: (prev: OfficeSnapshot) => OfficeSnapshot) => {
        if (!mine(e) || e.seq <= seq.current) return;
        if (e.seq !== seq.current + 1) {
          void resync();
          return;
        }
        seq.current = e.seq;
        setSession((prev) => (prev ? { ...apply(prev), seq: e.seq } : prev));
      };
      const handlers = {
        'office:participant': (e: { code: string; seq: number; participant: OfficeParticipant }) =>
          step(e, (prev) => ({
            ...prev,
            participants: [...prev.participants.filter((p) => p.id !== e.participant.id), e.participant].sort(
              byJoin,
            ),
            me: e.participant.id === prev.me.id ? { ...prev.me, joined: true } : prev.me,
          })),
        'office:participant-removed': (e: { code: string; seq: number; id: string }) =>
          step(e, (prev) => ({
            ...prev,
            participants: prev.participants.filter((p) => p.id !== e.id),
            me: e.id === prev.me.id ? { ...prev.me, joined: false } : prev.me,
          })),
        'office:session': (e: { code: string; seq: number; session: OfficeSessionInfo }) =>
          step(e, (prev) => ({
            ...prev,
            ...e.session,
            me: { ...prev.me, isHost: e.session.hostId === prev.me.id },
          })),
        'office:activity': (e: { code: string; seq: number; view: unknown }) =>
          step(e, (prev) => ({ ...prev, activity: e.view })),
        'office:kicked': (e: { code: string }) => {
          if (!mine(e)) return;
          joinedWith.current = null;
          setKicked(true);
        },
      };
      for (const [event, handler] of Object.entries(handlers))
        (s.on as (e: string, h: unknown) => void)(event, handler);

      const onConnect = () => {
        setConnection('online');
        // After a reconnect the server forgot which screens this socket shows: join again.
        if (joinedWith.current) void doJoin(joinedWith.current);
      };
      const onDisconnect = () => setConnection('offline');
      s.on('connect', onConnect);
      s.on('disconnect', onDisconnect);
      if (s.connected) onConnect();
      cleanup = () => {
        for (const [event, handler] of Object.entries(handlers))
          (s.off as (e: string, h: unknown) => void)(event, handler);
        s.off('connect', onConnect);
        s.off('disconnect', onDisconnect);
      };
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [code, doJoin, resync]);

  // Participants who have not joined yet still need to see the session (title, who is in).
  useEffect(() => {
    if (autoJoin || session || joinError) return;
    let cancelled = false;
    void getOfficeSocket().then(async (s) => {
      const res = await officeRequest<{ session: OfficeSnapshot }>(s, 'office:join', {
        code,
        screen: 'stage',
      });
      if (cancelled) return;
      if (res.ok) accept({ ...res.data.session, me: { ...res.data.session.me, screen } });
      else setJoinError(res.code);
    });
    return () => {
      cancelled = true;
    };
  }, [accept, autoJoin, code, joinError, screen, session]);

  const call = useCallback(
    async (event: 'office:update-me' | 'office:host' | 'office:action', payload: object) => {
      const s = socketRef.current ?? (await getOfficeSocket());
      const res = await officeRequest(s, event, { code, ...payload });
      return res.ok ? null : res.code;
    },
    [code],
  );

  return {
    session,
    joinError,
    kicked,
    connection,
    serverOffset,
    join: (input = {}) => doJoin(input),
    updateMe: (input) => call('office:update-me', input),
    host: (op) => call('office:host', op),
    action: (action) => call('office:action', { action }),
    leave: async () => {
      joinedWith.current = null;
      const s = socketRef.current;
      if (s) await officeRequest(s, 'office:leave', { code });
    },
  };
}
