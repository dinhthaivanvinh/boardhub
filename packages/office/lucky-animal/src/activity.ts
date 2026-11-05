import { z } from 'zod';
import type { ActivityContext, ActivityDefinition } from '@bg/office-core';

/** Thú may mắn (docs/office/activities/lucky-animal.md): pick N people at random with an animal race or a wheel. */
export const MODES = ['race', 'wheel', 'spotlight', 'claw'] as const;

export const settingsSchema = z.strictObject({
  mode: z.enum(MODES).default('race'),
  n: z.number().int().min(1).max(20).default(1),
  excludePrevious: z.boolean().default(true),
  hostParticipates: z.boolean().default(false),
});
export type LuckyAnimalSettings = z.infer<typeof settingsSchema>;

export const actionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('configure'), patch: settingsSchema.partial() }),
  z.strictObject({ kind: z.literal('draw') }),
  z.strictObject({ kind: z.literal('reset-exclusions') }),
]);
export type LuckyAnimalAction = z.infer<typeof actionSchema>;

export type LuckyAnimalState = {
  settings: LuckyAnimalSettings;
  rounds: { drawId: string; winners: string[]; mode: string }[];
  /** People already picked (when excludePrevious): left out of the next draws. */
  excluded: string[];
};

export type LuckyAnimalView = LuckyAnimalState & {
  /** How many people the next draw would pick from. */
  candidates: number;
};

/** Who can be picked now: everyone in the session (online or not, absent included), minus exclusions. */
export function candidatesOf(state: LuckyAnimalState, ctx: ActivityContext): string[] {
  return ctx.participants
    .filter((p) => state.settings.hostParticipates || p.id !== ctx.hostId)
    .filter((p) => !(state.settings.excludePrevious && state.excluded.includes(p.id)))
    .map((p) => p.id);
}

export const activity: ActivityDefinition<
  LuckyAnimalSettings,
  LuckyAnimalState,
  LuckyAnimalAction,
  LuckyAnimalView
> = {
  meta: {
    id: 'lucky-animal',
    i18nKey: 'office.activities.lucky-animal',
    maxParticipants: 200,
    modes: MODES,
  },
  settingsSchema,
  actionSchema,
  setup: (settings) => ({ settings, rounds: [], excluded: [] }),
  validate(state, actor, action, ctx) {
    if (!actor.isHost) return { ok: false, code: 'office.not_host' };
    if (action.kind === 'draw' && candidatesOf(state, ctx).length < state.settings.n) {
      return { ok: false, code: 'office.not_enough' };
    }
    return { ok: true };
  },
  apply(state, _actor, action, ctx) {
    switch (action.kind) {
      case 'configure': {
        const patch = Object.fromEntries(Object.entries(action.patch).filter(([, v]) => v !== undefined));
        return { state: { ...state, settings: { ...state.settings, ...patch } } };
      }
      case 'reset-exclusions':
        return { state: { ...state, excluded: [] } };
      case 'draw':
        // The hub draws (rule A5): commit-reveal, the activity never picks at random itself.
        return {
          state,
          draw: { n: state.settings.n, candidates: candidatesOf(state, ctx), mode: state.settings.mode },
        };
    }
  },
  onDrawResult(state, result) {
    return {
      ...state,
      rounds: [...state.rounds, { drawId: result.drawId, winners: result.winners, mode: result.mode }],
      excluded: state.settings.excludePrevious ? [...state.excluded, ...result.winners] : state.excluded,
    };
  },
  // Nothing is hidden: every screen sees the same.
  view: (state, _screen, _viewer, ctx) => ({ ...state, candidates: candidatesOf(state, ctx).length }),
};
