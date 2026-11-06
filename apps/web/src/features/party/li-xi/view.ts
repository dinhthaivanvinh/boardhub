import { valueOf, type Gift, type LiXiView } from '@bg/office-li-xi';
import type { OfficeDrawRecord, OfficeDrawStarted, OfficeSnapshot } from '@bg/protocol';
import { isRevealed } from '@/features/office/draw-player/timeline';
import { lastOne } from './timeline';

function asLiXiView(activity: unknown): LiXiView | null {
  const v = activity as Partial<LiXiView> | null;
  return v && Array.isArray(v.gifts) && v.settings ? (v as LiXiView) : null;
}

/**
 * The session's Lì xì view, with `waiting` and `done` counted from the live list of people: the server
 * sends the activity view again only after an action, while people keep joining (same rule as recipientsOf).
 */
export function liXiViewOf(session: OfficeSnapshot): LiXiView | null {
  const view = asLiXiView(session.activity);
  if (!view) return null;
  const got = new Set(view.gifts.map((g) => g.recipient));
  const waiting = session.participants.filter(
    (p) => (view.settings.hostReceives || p.id !== session.hostId) && !got.has(p.id),
  ).length;
  return { ...view, waiting, done: view.started && waiting === 0 };
}

/**
 * The view as the room should see it now: the gift of the turn still playing stays secret until its
 * envelope is open (the server already knows it from the reveal on).
 */
export function heldBack(view: LiXiView, drawId: string | null, open: boolean): LiXiView {
  if (!drawId || open) return view;
  const gift = view.gifts.find((g) => g.drawId === drawId);
  if (!gift) return view;
  const row = /^L(\d+)-/.exec(gift.envelope);
  return {
    ...view,
    gifts: view.gifts.filter((g) => g !== gift),
    left: view.left.map((n, i) => (n !== null && row && Number(row[1]) === i ? n + 1 : n)),
    waiting: view.waiting + 1,
    total: view.total - gift.value,
    done: false,
  };
}

/** The gift a revealed draw handed out, from the record alone (the view may lag behind). */
export function giftOf(
  view: LiXiView,
  draw: OfficeDrawStarted | OfficeDrawRecord,
): Pick<Gift, 'recipient' | 'envelope' | 'value' | 'name' | 'avatar'> | null {
  if (!isRevealed(draw)) {
    // The last person walks up before the reveal: who it is is known, their envelope is not (yet).
    const who = lastOne(draw) ? draw.candidates[0] : undefined;
    return who ? { recipient: who.id, envelope: '', value: 0, name: who.name, avatar: who.avatar } : null;
  }
  const recipient = draw.winners[0];
  const envelope = draw.awarded?.[0];
  const who = draw.candidates.find((c) => c.id === recipient);
  if (!recipient || !envelope || !who) return null;
  return { recipient, envelope, value: valueOf(view.settings, envelope), name: who.name, avatar: who.avatar };
}

/** The same wish for a turn on every screen (no randomness: picked from the draw id). */
export function wishIndex(drawId: string, count: number): number {
  let h = 2166136261;
  for (let i = 0; i < drawId.length; i++) h = Math.imul(h ^ drawId.charCodeAt(i), 16777619);
  return (h >>> 0) % count;
}

export const WISH_COUNT = 12;

/** Colours of a stylised note (not a real banknote), by value. */
export function noteColours(value: number): { paper: string; ink: string; edge: string } {
  if (value >= 500_000) return { paper: '#a5f3fc', ink: '#155e75', edge: '#0891b2' };
  if (value >= 200_000) return { paper: '#fecaca', ink: '#7f1d1d', edge: '#dc2626' };
  if (value >= 100_000) return { paper: '#bbf7d0', ink: '#14532d', edge: '#16a34a' };
  if (value >= 50_000) return { paper: '#fbcfe8', ink: '#831843', edge: '#db2777' };
  if (value >= 20_000) return { paper: '#bfdbfe', ink: '#1e3a8a', edge: '#2563eb' };
  return { paper: '#fde68a', ink: '#713f12', edge: '#ca8a04' };
}

/** The biggest value the host set: that envelope gets fireworks. */
export const topValue = (view: LiXiView) => Math.max(...view.settings.denominations.map((d) => d.value));
