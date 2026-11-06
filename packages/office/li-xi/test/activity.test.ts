import { describe, expect, it } from 'vitest';
import { commitment, drawPrizes, drawWinners, type ActivityContext, type Participant } from '@bg/office-core';
import { defaultAvatar } from '@bg/avatars/random';
import {
  activity,
  envelopePool,
  notesLeft,
  recipientsOf,
  settingsSchema,
  valueOf,
  type LiXiState,
} from '../src/activity';

const person = (id: string, joinedAt = 0): Participant => ({
  id,
  name: id.toUpperCase(),
  avatar: defaultAvatar(id),
  online: true,
  joinedAt,
  absent: false,
});
const ctxWith = (ids: string[], hostId = 'h'): ActivityContext => ({
  participants: ids.map((id, i) => person(id, i)),
  hostId,
  now: 0,
});
const host = { id: 'h', isHost: true };
const guest = { id: 'a', isHost: false };
const fresh = (settings: object = {}) => activity.setup(settingsSchema.parse(settings));

/** Runs "next" like the hub would: a real draw on the request, then onDrawResult. */
function next(state: LiXiState, ctx: ActivityContext, drawId: string): LiXiState {
  const { draw } = activity.apply(state, host, { kind: 'next' }, ctx);
  if (!draw?.prizes) throw new Error('expected a draw with prizes');
  const seed = commitment(drawId.padEnd(64, '0').replace(/[^0-9a-f]/g, 'a'));
  const winners = drawWinners(seed, drawId, draw.candidates, 1);
  const awarded = drawPrizes(seed, drawId, draw.prizes, 1);
  return activity.onDrawResult(state, { drawId, mode: draw.mode, winners, awarded }, ctx);
}

const SETTINGS = {
  denominations: [
    { value: 500_000, count: 3 },
    { value: 200_000, count: 5 },
    { value: 50_000, count: null },
  ],
};

describe('li-xi settings', () => {
  it('defaults and limits', () => {
    expect(settingsSchema.parse({})).toMatchObject({ order: 'random', hostReceives: false });
    expect(settingsSchema.safeParse(SETTINGS).success).toBe(true);
    // One row per value, at most one unlimited row, sensible amounts.
    expect(
      settingsSchema.safeParse({
        denominations: [
          { value: 50_000, count: 1 },
          { value: 50_000, count: 2 },
        ],
      }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        denominations: [
          { value: 10_000, count: null },
          { value: 20_000, count: null },
        ],
      }).success,
    ).toBe(false);
    expect(settingsSchema.safeParse({ denominations: [{ value: 500, count: 1 }] }).success).toBe(false);
    expect(settingsSchema.safeParse({ denominations: [] }).success).toBe(false);
  });
});

describe('li-xi', () => {
  it('only the host acts; settings are fixed once giving starts', () => {
    const s = fresh(SETTINGS);
    const ctx = ctxWith(['h', 'a', 'b']);
    expect(activity.validate(s, guest, { kind: 'start' }, ctx)).toEqual({
      ok: false,
      code: 'office.not_host',
    });
    expect(activity.validate(s, host, { kind: 'next' }, ctx)).toEqual({
      ok: false,
      code: 'office.bad_action',
    });
    const configured = activity.apply(s, host, { kind: 'configure', patch: { order: 'joined' } }, ctx).state;
    expect(configured.settings.order).toBe('joined');
    const started = activity.apply(s, host, { kind: 'start' }, ctx).state;
    expect(started.started).toBe(true);
    expect(activity.validate(started, host, { kind: 'configure', patch: {} }, ctx)).toEqual({
      ok: false,
      code: 'office.bad_action',
    });
    expect(activity.validate(started, host, { kind: 'start' }, ctx).ok).toBe(false);
  });

  it('cannot start with nobody to give to', () => {
    expect(activity.validate(fresh(), host, { kind: 'start' }, ctxWith(['h']))).toEqual({
      ok: false,
      code: 'office.not_enough',
    });
  });

  it('the pile: every limited note, then unlimited notes for the rest', () => {
    const s = fresh(SETTINGS);
    // 12 people waiting: 3 + 5 limited, 4 of 50.000.
    const pool = envelopePool(s, 12);
    expect(pool.filter((e) => e.startsWith('L0-'))).toHaveLength(3);
    expect(pool.filter((e) => e.startsWith('L1-'))).toHaveLength(5);
    expect(pool.filter((e) => e.startsWith('U2-'))).toHaveLength(4);
    // Fewer people than notes: only limited notes, some stay on the table.
    expect(envelopePool(s, 5)).toHaveLength(8);
    // No unlimited row and too few notes: wishes for the rest.
    const wishes = fresh({ denominations: [{ value: 100_000, count: 2 }] });
    expect(envelopePool(wishes, 4).sort()).toEqual(['B-1', 'B-2', 'L0-1', 'L0-2']);
    expect(valueOf(wishes.settings, 'B-1')).toBe(0);
    expect(valueOf(s.settings, 'U2-7')).toBe(50_000);
  });

  it('gives everyone exactly one envelope, never more notes than were set aside', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `p${String(i).padStart(2, '0')}`);
    const ctx = ctxWith(['h', ...ids]);
    let s = activity.apply(fresh(SETTINGS), host, { kind: 'start' }, ctx).state;
    for (let i = 0; i < 20; i++) s = next(s, ctx, `draw-${i}`);
    const view = activity.view(s, 'stage', null, ctx);
    expect(view.done).toBe(true);
    expect(view.waiting).toBe(0);
    expect(new Set(s.gifts.map((g) => g.recipient)).size).toBe(20);
    expect(s.gifts.some((g) => g.recipient === 'h')).toBe(false);
    expect(s.gifts.filter((g) => g.value === 500_000)).toHaveLength(3);
    expect(s.gifts.filter((g) => g.value === 200_000)).toHaveLength(5);
    expect(s.gifts.filter((g) => g.value === 50_000)).toHaveLength(12);
    expect(view.total).toBe(3 * 500_000 + 5 * 200_000 + 12 * 50_000);
    expect(view.left).toEqual([0, 0, null]);
    expect(notesLeft(s)).toEqual([0, 0, null]);
    expect(activity.validate(s, host, { kind: 'next' }, ctx)).toEqual({
      ok: false,
      code: 'office.not_enough',
    });
  });

  it('a gift keeps the name and animal of that moment; latecomers can still receive', () => {
    const ctx = ctxWith(['h', 'a']);
    let s = activity.apply(fresh(SETTINGS), host, { kind: 'start' }, ctx).state;
    s = next(s, ctx, 'd1');
    expect(s.gifts[0]).toMatchObject({ recipient: 'a', name: 'A' });
    const later = ctxWith(['h', 'a', 'z']);
    expect(recipientsOf(s, later)).toEqual(['z']);
    s = next(s, later, 'd2');
    expect(s.gifts.map((g) => g.recipient)).toEqual(['a', 'z']);
  });

  it('in "joined" order the next person is fixed; only the envelope is drawn', () => {
    const ctx = ctxWith(['h', 'c', 'a', 'b']); // joined in that order
    let s = activity.apply(fresh({ ...SETTINGS, order: 'joined' }), host, { kind: 'start' }, ctx).state;
    expect(recipientsOf(s, ctx)).toEqual(['c']);
    s = next(s, ctx, 'd1');
    expect(recipientsOf(s, ctx)).toEqual(['a']);
  });

  it('the host can receive too, if asked', () => {
    const ctx = ctxWith(['h', 'a']);
    expect(recipientsOf(fresh({ hostReceives: true }), ctx).sort()).toEqual(['a', 'h']);
  });

  it('ignores a result without a recipient or an envelope, and never mutates', () => {
    const ctx = ctxWith(['h', 'a']);
    const s = fresh(SETTINGS);
    const copy = structuredClone(s);
    expect(activity.onDrawResult(s, { drawId: 'x', mode: 'li-xi', winners: ['a'] }, ctx)).toBe(s);
    expect(
      activity.onDrawResult(s, { drawId: 'x', mode: 'li-xi', winners: ['gone'], awarded: ['L0-1'] }, ctx),
    ).toBe(s);
    activity.apply(s, host, { kind: 'start' }, ctx);
    expect(s).toEqual(copy);
    expect(JSON.parse(JSON.stringify(activity.view(s, 'host', 'h', ctx)))).toEqual(
      activity.view(s, 'host', 'h', ctx),
    );
  });
});
