'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BotLevel,
  ChatMessage,
  MatchActionType,
  MatchSnapshot,
  RoomJoined,
  RoomSnapshot,
  ServerToClientEvents,
} from '@bg/protocol';
import { newSeed } from '@/game-runtime/local-match';
import { useSession } from './session';
import { getSocket, request, type GameSocket } from './socket';

export interface ReceivedMatch {
  snapshot: MatchSnapshot;
  /** Local time when it arrived; clocks count down from here. */
  receivedAt: number;
  /** serverTime - local time, to show server deadlines (grace periods) in local time. */
  serverOffset: number;
}

export type Connection = 'connecting' | 'online' | 'offline';

const stamp = (snapshot: MatchSnapshot): ReceivedMatch => {
  const receivedAt = Date.now();
  return { snapshot, receivedAt, serverOffset: snapshot.serverTime - receivedAt };
};

/**
 * Joins a room by code and keeps its state in sync with the server (docs/05 §5).
 * Rejoins after every reconnect; the server is the only source of truth.
 */
export function useRoom(code: string) {
  const userId = useSession((s) => s.user?.id ?? null);
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [match, setMatch] = useState<ReceivedMatch | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [movePending, setMovePending] = useState(false);
  const roomId = useRef<string | null>(null);
  const matchRef = useRef<ReceivedMatch | null>(null);
  matchRef.current = match;

  useEffect(() => {
    let cancelled = false;
    let s: GameSocket | null = null;

    const join = async () => {
      if (!s) return;
      const res = await request<RoomJoined>(s, 'room:join', { code });
      if (cancelled) return;
      if (!res.ok) return setJoinError(res.code);
      roomId.current = res.data.room.id;
      setJoinError(null);
      setRoom(res.data.room);
      setMatch(res.data.match ? stamp(res.data.match) : null);
      setChat(res.data.chat);
    };
    const onConnect = () => {
      setConnection('online');
      void join();
    };
    const onDisconnect = () => setConnection('offline');
    const onRoom: ServerToClientEvents['room:updated'] = (r) => {
      if (r.id === roomId.current) setRoom(r);
    };
    const onMatch: ServerToClientEvents['match:state'] = (m) => {
      if (m.roomId !== roomId.current) return;
      // Ignore out-of-order updates for the same match.
      setMatch((prev) =>
        !prev || prev.snapshot.matchId !== m.matchId || m.seq >= prev.snapshot.seq ? stamp(m) : prev,
      );
    };
    const onChat: ServerToClientEvents['chat:message'] = (c) => {
      if (c.roomId === roomId.current) setChat((prev) => [...prev, c].slice(-100));
    };

    getSocket()
      .then((sock) => {
        if (cancelled) return;
        s = sock;
        setSocket(sock);
        sock.on('connect', onConnect);
        sock.on('disconnect', onDisconnect);
        sock.on('room:updated', onRoom);
        sock.on('match:state', onMatch);
        sock.on('chat:message', onChat);
        if (sock.connected) onConnect();
      })
      .catch(() => setJoinError('network'));

    return () => {
      cancelled = true;
      if (!s) return;
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('room:updated', onRoom);
      s.off('match:state', onMatch);
      s.off('chat:message', onChat);
    };
  }, [code]);

  const act = useCallback(
    async (event: Parameters<typeof request>[1], payload: unknown): Promise<string | null> => {
      if (!socket) return 'network';
      const res = await request(socket, event, payload);
      setActionError(res.ok ? null : res.code);
      return res.ok ? null : res.code;
    },
    [socket],
  );

  const resync = useCallback(async () => {
    const current = matchRef.current;
    if (!socket || !current) return;
    const res = await request<{ match: MatchSnapshot }>(socket, 'match:resync', {
      matchId: current.snapshot.matchId,
    });
    if (res.ok) setMatch(stamp(res.data.match));
  }, [socket]);

  const submitMove = useCallback(
    async (move: unknown) => {
      const current = matchRef.current;
      if (!current || movePending) return;
      setMovePending(true);
      const error = await act('move:submit', {
        matchId: current.snapshot.matchId,
        seq: current.snapshot.seq,
        clientMoveId: newSeed(),
        move,
      });
      setMovePending(false);
      if (error === 'match.stale_seq') await resync();
    },
    [act, movePending, resync],
  );

  const id = room?.id ?? '';
  const mySeat = room?.seats.findIndex((s) => s?.kind === 'user' && s.userId === userId) ?? -1;

  return {
    connection,
    room,
    match,
    chat,
    joinError,
    actionError,
    movePending,
    userId,
    mySeat: mySeat >= 0 ? mySeat : null,
    isHost: room !== null && room.hostId === userId,
    takeSeat: (seat: number | null) => act('room:take-seat', { roomId: id, seat }),
    setReady: (ready: boolean) => act('room:set-ready', { roomId: id, ready }),
    addBot: (seat: number, level: BotLevel) => act('room:add-bot', { roomId: id, seat, level }),
    removeBot: (seat: number) => act('room:remove-bot', { roomId: id, seat }),
    start: () => act('room:start', { roomId: id }),
    rematch: () => act('room:rematch', { roomId: id }),
    leave: () => act('room:leave', { roomId: id }),
    sendChat: (text: string) => act('chat:send', { roomId: id, text }),
    matchAction: (action: MatchActionType) =>
      act('match:action', { matchId: matchRef.current?.snapshot.matchId ?? '', action }),
    submitMove,
  };
}

export type RoomApi = ReturnType<typeof useRoom>;
