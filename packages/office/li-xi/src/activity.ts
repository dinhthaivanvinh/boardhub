import { z } from 'zod';
import type { ActivityContext, ActivityDefinition } from '@bg/office-core';
import type { Avatar } from '@bg/avatars/schema';

/**
 * Lì xì Tết (docs/office/activities/li-xi.md): the host gives red envelopes. One person at a time is
 * called up and opens an envelope; who is called and which envelope they get are both chosen by the hub's
 * fair draw (rule A5), the envelope through the draw's prize pool (docs/office/04 §5).
 *
 * The envelopes work like a real pile: every limited note the host set aside, plus as many envelopes of
 * the "unlimited" note as needed so that everyone still waiting gets one. With no unlimited note and more
 * people than notes, the last envelopes hold a New Year wish instead of money.
 */

export const MODES = ['li-xi'] as const;

export const Denomination = z.strictObject({
  /** Value in đồng. */
  value: z.number().int().min(1_000).max(10_000_000),
  /** How many notes of this value; null = as many as needed. */
  count: z.number().int().min(1).max(500).nullable(),
});
export type Denomination = z.infer<typeof Denomination>;

export const settingsSchema = z.strictObject({
  denominations: z
    .array(Denomination)
    .min(1)
    .max(8)
    .refine((ds) => new Set(ds.map((d) => d.value)).size === ds.length, 'one row per value')
    .refine((ds) => ds.filter((d) => d.count === null).length <= 1, 'at most one unlimited value')
    .default([
      { value: 500_000, count: 1 },
      { value: 200_000, count: 3 },
      { value: 50_000, count: null },
    ]),
  /** Who is called up next: picked at random, or in the order people joined. */
  order: z.enum(['random', 'joined']).default('random'),
  /** The host is usually the one giving. */
  hostReceives: z.boolean().default(false),
});
export type LiXiSettings = z.infer<typeof settingsSchema>;

export const actionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('configure'), patch: settingsSchema.partial() }),
  z.strictObject({ kind: z.literal('start') }),
  z.strictObject({ kind: z.literal('next') }),
]);
export type LiXiAction = z.infer<typeof actionSchema>;

export interface Gift {
  drawId: string;
  recipient: string;
  /** As they were when they received it (names and animals can change later). */
  name: string;
  avatar: Avatar;
  /** Envelope id from the prize pool: "L<row>-<n>", "U<row>-<n>" or "B-<n>" (a wish, no money). */
  envelope: string;
  /** In đồng; 0 for a wish. */
  value: number;
}

export type LiXiState = {
  settings: LiXiSettings;
  started: boolean;
  gifts: Gift[];
};

export interface LiXiView {
  settings: LiXiSettings;
  started: boolean;
  gifts: Gift[];
  /** Notes left per row of the settings (null = unlimited). */
  left: (number | null)[];
  /** People still waiting for an envelope. */
  waiting: number;
  /** Money given so far, in đồng. */
  total: number;
  /** Everyone has received an envelope. */
  done: boolean;
}

/** The value of an envelope id ("L0-3" → the first row's value; "B-2" → 0). */
export function valueOf(settings: LiXiSettings, envelope: string): number {
  const m = /^[LU](\d+)-\d+$/.exec(envelope);
  return m ? (settings.denominations[Number(m[1])]?.value ?? 0) : 0;
}

/** Who can still be called up: everyone without an envelope (the host only if they receive too). */
export function recipientsOf(state: LiXiState, ctx: ActivityContext): string[] {
  const got = new Set(state.gifts.map((g) => g.recipient));
  const left = ctx.participants
    .filter((p) => state.settings.hostReceives || p.id !== ctx.hostId)
    .filter((p) => !got.has(p.id));
  if (state.settings.order === 'random') return left.map((p) => p.id);
  // In the order people joined (ties by id): only the next one is a candidate.
  const next = [...left].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))[0];
  return next ? [next.id] : [];
}

/** How many people are still waiting (whatever the order). */
function waitingOf(state: LiXiState, ctx: ActivityContext): number {
  const got = new Set(state.gifts.map((g) => g.recipient));
  return ctx.participants.filter(
    (p) => (state.settings.hostReceives || p.id !== ctx.hostId) && !got.has(p.id),
  ).length;
}

/** Limited notes not handed out yet, per row (null for the unlimited row). */
export function notesLeft(state: LiXiState): (number | null)[] {
  return state.settings.denominations.map((d, row) =>
    d.count === null ? null : d.count - state.gifts.filter((g) => g.envelope.startsWith(`L${row}-`)).length,
  );
}

/**
 * The envelopes on the table now: every limited note left, then enough of the unlimited note (or of
 * wishes) for everyone still waiting. Ids are unique within the pool, which is all the draw needs.
 */
export function envelopePool(state: LiXiState, waiting: number): string[] {
  const given = new Set(state.gifts.map((g) => g.envelope));
  const pool: string[] = [];
  state.settings.denominations.forEach((d, row) => {
    if (d.count === null) return;
    for (let n = 1; n <= d.count; n++) if (!given.has(`L${row}-${n}`)) pool.push(`L${row}-${n}`);
  });
  const fill = Math.max(0, waiting - pool.length);
  const unlimited = state.settings.denominations.findIndex((d) => d.count === null);
  for (let n = 1; n <= fill; n++) pool.push(unlimited >= 0 ? `U${unlimited}-${n}` : `B-${n}`);
  return pool;
}

export const activity: ActivityDefinition<LiXiSettings, LiXiState, LiXiAction, LiXiView> = {
  meta: { id: 'li-xi', i18nKey: 'office.activities.li-xi', maxParticipants: 200, modes: MODES },
  settingsSchema,
  actionSchema,
  setup: (settings) => ({ settings, started: false, gifts: [] }),
  validate(state, actor, action, ctx) {
    if (!actor.isHost) return { ok: false, code: 'office.not_host' };
    switch (action.kind) {
      case 'configure':
        // The envelopes are fixed once the giving has started.
        return state.started ? { ok: false, code: 'office.bad_action' } : { ok: true };
      case 'start':
        if (state.started) return { ok: false, code: 'office.bad_action' };
        return recipientsOf(state, ctx).length > 0 ? { ok: true } : { ok: false, code: 'office.not_enough' };
      case 'next':
        if (!state.started) return { ok: false, code: 'office.bad_action' };
        return recipientsOf(state, ctx).length > 0 ? { ok: true } : { ok: false, code: 'office.not_enough' };
    }
  },
  apply(state, _actor, action, ctx) {
    switch (action.kind) {
      case 'configure': {
        const patch = Object.fromEntries(Object.entries(action.patch).filter(([, v]) => v !== undefined));
        return { state: { ...state, settings: { ...state.settings, ...patch } } };
      }
      case 'start':
        return { state: { ...state, started: true } };
      case 'next':
        // The hub picks the person and the envelope together (rule A5).
        return {
          state,
          draw: {
            n: 1,
            candidates: recipientsOf(state, ctx),
            mode: 'li-xi',
            prizes: envelopePool(state, waitingOf(state, ctx)),
          },
        };
    }
  },
  onDrawResult(state, result, ctx) {
    const recipient = result.winners[0];
    const envelope = result.awarded?.[0];
    if (!recipient || !envelope) return state;
    const who = ctx.participants.find((p) => p.id === recipient);
    if (!who) return state;
    const gift: Gift = {
      drawId: result.drawId,
      recipient,
      name: who.name,
      avatar: who.avatar,
      envelope,
      value: valueOf(state.settings, envelope),
    };
    return { ...state, gifts: [...state.gifts, gift] };
  },
  // Nothing is hidden: the envelopes left are on the table for everyone to see.
  view(state, _screen, _viewer, ctx) {
    const waiting = waitingOf(state, ctx);
    return {
      settings: state.settings,
      started: state.started,
      gifts: state.gifts,
      left: notesLeft(state),
      waiting,
      total: state.gifts.reduce((sum, g) => sum + g.value, 0),
      done: state.started && waiting === 0,
    };
  },
};
