import { describe, expect, it } from 'vitest';
import { DRAW_LANDING_MS } from '@bg/office-core';
import { defaultAvatar } from '@bg/avatars/random';
import { settingsSchema, type LiXiView } from '@bg/office-li-xi';
import type { OfficeDrawRecord, OfficeSnapshot } from '@bg/protocol';
import { areaOf, sessionPath, SESSION_PATH_RE } from '@/office/areas';
import { formatVnd, previewOf, shortVnd } from '@/features/party/money';
import {
  LI_XI_GIFT_MS,
  LI_XI_STEPS,
  liXiPhaseAt,
  reached,
  turnEndsAt,
} from '@/features/party/li-xi/timeline';
import { giftOf, heldBack, liXiViewOf, wishIndex } from '@/features/party/li-xi/view';

const settings = settingsSchema.parse({
  denominations: [
    { value: 500_000, count: 1 },
    { value: 200_000, count: 2 },
    { value: 50_000, count: null },
  ],
});

const record: OfficeDrawRecord = {
  drawId: 'd1',
  round: 1,
  mode: 'li-xi',
  n: 1,
  candidates: [
    { id: 'a', name: 'An', avatar: defaultAvatar('a') },
    { id: 'b', name: 'Bình', avatar: defaultAvatar('b') },
  ],
  commitment: 'c',
  startsAt: 1_000,
  revealAt: 5_000,
  prizes: ['L0-1', 'L1-1', 'L1-2'],
  seed: 's',
  winners: ['b'],
  awarded: ['L1-2'],
  revealedAt: 5_000,
} as OfficeDrawRecord;

const view: LiXiView = {
  settings,
  started: true,
  gifts: [
    {
      drawId: 'd1',
      recipient: 'b',
      name: 'Bình',
      avatar: defaultAvatar('b'),
      envelope: 'L1-2',
      value: 200_000,
    },
  ],
  left: [1, 1, null],
  waiting: 1,
  total: 200_000,
  done: false,
};

describe('party areas', () => {
  it('sends Lì xì sessions to /party and the rest to /office', () => {
    expect(areaOf('li-xi')).toBe('party');
    expect(areaOf('lucky-animal')).toBe('office');
    expect(areaOf(null)).toBe('office');
    expect(sessionPath('li-xi', 'ABC123', '/host')).toBe('/party/s/ABC123/host');
    expect(sessionPath('lucky-animal', 'ABC123')).toBe('/office/s/ABC123');
    expect(SESSION_PATH_RE.test('/party/s/ABC123')).toBe(true);
    expect(SESSION_PATH_RE.test('/party/s/ABC123/host')).toBe(false);
  });
});

describe('Lì xì money and preview', () => {
  it('formats đồng', () => {
    expect(formatVnd('vi', 500_000)).toMatch(/500\.000/);
    expect(shortVnd(500_000)).toBe('500K');
    expect(shortVnd(2_000_000)).toBe('2M');
    expect(shortVnd(1_500_000)).toBe('1.5M');
  });

  it('previews the pile like the server: exact with enough people, a range otherwise', () => {
    const many = previewOf(settings, 6);
    expect(many.exact).toBe(true);
    expect(many.rows.map((r) => r.count)).toEqual([1, 2, 3]);
    expect(many.max).toBe(500_000 + 2 * 200_000 + 3 * 50_000);
    const few = previewOf(settings, 2);
    expect(few.exact).toBe(false);
    expect(few.max).toBe(700_000);
    expect(few.min).toBe(400_000);
    const noUnlimited = settingsSchema.parse({ denominations: [{ value: 100_000, count: 1 }] });
    expect(previewOf(noUnlimited, 3).wishes).toBe(2);
  });
});

describe('Lì xì timeline', () => {
  const after = (ms: number) => record.revealAt + DRAW_LANDING_MS + ms;

  it('follows the draw, then walks, opens and shows', () => {
    expect(liXiPhaseAt(record, 500, true).kind).toBe('countdown');
    expect(liXiPhaseAt(record, 2_000, true).kind).toBe('buildUp');
    expect(liXiPhaseAt(record, 6_000, true).kind).toBe('landing');
    let at = 0;
    for (const [step, ms] of LI_XI_STEPS) {
      const p = liXiPhaseAt(record, after(at + 10), true);
      expect(p).toMatchObject({ kind: 'gift', step });
      at += ms;
    }
    const end = liXiPhaseAt(record, after(LI_XI_GIFT_MS + 1), true);
    expect(end).toMatchObject({ kind: 'gift', step: 'shown' });
    expect(reached(end, 'note')).toBe(true);
    expect(reached(liXiPhaseAt(record, after(10), true), 'note')).toBe(false);
  });

  it('calls the last person straight up: no spotlight, the envelope shakes until the reveal', () => {
    const only = { ...record, candidates: [record.candidates[1]!], revealedAt: 3_600 } as OfficeDrawRecord;
    const { seed: _s, winners: _w, awarded: _a, revealedAt: _r, ...started } = only;
    expect(liXiPhaseAt(started, 500, true).kind).toBe('countdown');
    expect(liXiPhaseAt(started, 1_100, true)).toMatchObject({ kind: 'gift', step: 'walk' });
    expect(liXiPhaseAt(started, 4_500, true)).toMatchObject({ kind: 'gift', step: 'shake' });
    expect(liXiPhaseAt(started, 9_000, true)).toMatchObject({ kind: 'gift', step: 'shake' });
    expect(turnEndsAt(started)).toBeNull();
    // Revealed on time: the envelope opens right after the shake, long before a spotlight would end.
    expect(liXiPhaseAt(only, 4_300, true)).toMatchObject({ kind: 'gift', step: 'open' });
    expect(turnEndsAt(only)).toBe(1_000 + LI_XI_GIFT_MS);
    expect(turnEndsAt(record)).toBe(5_000 + DRAW_LANDING_MS + LI_XI_GIFT_MS);
    // Who it is shows at once; the envelope's value only after the reveal.
    expect(giftOf(view, started)).toMatchObject({ recipient: 'b', value: 0 });
    expect(giftOf(view, { ...started, candidates: record.candidates })).toBeNull();
  });

  it('without animations, the envelope is simply open at the reveal', () => {
    expect(liXiPhaseAt(record, 4_000, false).kind).toBe('countdown');
    expect(liXiPhaseAt(record, 5_000, false)).toMatchObject({ kind: 'gift', step: 'shown' });
  });
});

describe('Lì xì view on screens', () => {
  it('keeps the turn playing secret until the envelope is open', () => {
    const hidden = heldBack(view, 'd1', false);
    expect(hidden.gifts).toHaveLength(0);
    expect(hidden.total).toBe(0);
    expect(hidden.left).toEqual([1, 2, null]);
    expect(hidden.waiting).toBe(2);
    expect(heldBack(view, 'd1', true)).toBe(view);
    expect(heldBack(view, 'other', false)).toBe(view);
  });

  it('reads the gift from the draw record, and the same wish on every screen', () => {
    expect(giftOf(view, record)).toMatchObject({ recipient: 'b', envelope: 'L1-2', value: 200_000 });
    expect(wishIndex('d1', 12)).toBe(wishIndex('d1', 12));
    expect(wishIndex('d1', 12)).toBeGreaterThanOrEqual(0);
    expect(wishIndex('d1', 12)).toBeLessThan(12);
  });

  it('counts the people waiting from the live list (newcomers included)', () => {
    const p = (id: string) => ({
      id,
      name: id,
      avatar: defaultAvatar(id),
      online: true,
      joinedAt: 0,
      absent: false,
    });
    const session = {
      hostId: 'h',
      activity: view,
      participants: [p('h'), p('a'), p('b'), p('late')],
    } as unknown as OfficeSnapshot;
    expect(liXiViewOf(session)).toMatchObject({ waiting: 2, done: false });
  });
});
