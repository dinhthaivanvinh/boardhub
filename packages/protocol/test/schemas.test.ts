import { describe, expect, it } from 'vitest';
import {
  ChatSend,
  LoginRequest,
  MoveSubmit,
  RegisterRequest,
  RoomCreate,
  RoomJoin,
  TIME_CONTROL_PRESETS,
  TimeControlSchema,
} from '../src';

describe('protocol schemas', () => {
  it('room:create fills safe defaults', () => {
    expect(RoomCreate.parse({ gameId: 'caro' })).toEqual({
      gameId: 'caro',
      timeControl: { type: 'none' },
      disconnectPolicy: 'forfeit',
      hostSeat: 0,
    });
  });

  it('rejects unknown fields everywhere', () => {
    expect(RoomCreate.safeParse({ gameId: 'caro', admin: true }).success).toBe(false);
    expect(
      MoveSubmit.safeParse({ matchId: 'm', seq: 0, clientMoveId: '12345678', move: {}, x: 1 }).success,
    ).toBe(false);
  });

  it('normalises room codes', () => {
    expect(RoomJoin.parse({ code: ' ab12cd ' })).toEqual({ code: 'AB12CD' });
    expect(RoomJoin.safeParse({ code: 'ABC' }).success).toBe(false);
    expect(RoomJoin.safeParse({ code: 'AB-12C' }).success).toBe(false);
  });

  it('validates time controls and presets', () => {
    for (const preset of Object.values(TIME_CONTROL_PRESETS))
      expect(TimeControlSchema.parse(preset)).toEqual(preset);
    expect(TimeControlSchema.safeParse({ type: 'fischer', baseMs: 1000, incrementMs: 0 }).success).toBe(
      false,
    );
    expect(TimeControlSchema.safeParse({ type: 'sudden' }).success).toBe(false);
  });

  it('limits chat length and trims', () => {
    expect(ChatSend.parse({ roomId: 'r', text: '  hi  ' }).text).toBe('hi');
    expect(ChatSend.safeParse({ roomId: 'r', text: '   ' }).success).toBe(false);
    expect(ChatSend.safeParse({ roomId: 'r', text: 'x'.repeat(301) }).success).toBe(false);
  });

  it('move ids must look like ids and seq cannot be negative', () => {
    expect(MoveSubmit.safeParse({ matchId: 'm', seq: -1, clientMoveId: '12345678', move: {} }).success).toBe(
      false,
    );
    expect(MoveSubmit.safeParse({ matchId: 'm', seq: 0, clientMoveId: 'short', move: {} }).success).toBe(
      false,
    );
  });

  it('normalises emails and requires decent passwords', () => {
    expect(RegisterRequest.parse({ email: ' A@B.Com ', password: '12345678', displayName: 'An' }).email).toBe(
      'a@b.com',
    );
    expect(
      RegisterRequest.safeParse({ email: 'a@b.com', password: 'short', displayName: 'An' }).success,
    ).toBe(false);
    expect(LoginRequest.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });
});
