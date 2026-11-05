import { z } from 'zod';
import type { ActivityDefinition } from '@bg/office-core';

/** Thú may mắn (docs/office/activities/lucky-animal.md). O2: settings only; the draw comes in O3. */
export const MODES = ['race', 'wheel'] as const;

export const settingsSchema = z.strictObject({
  mode: z.enum(MODES).default('race'),
  n: z.number().int().min(1).max(20).default(1),
  excludePrevious: z.boolean().default(true),
  hostParticipates: z.boolean().default(false),
});
export type LuckyAnimalSettings = z.infer<typeof settingsSchema>;

export const actionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('configure'), patch: settingsSchema.partial() }),
]);
export type LuckyAnimalAction = z.infer<typeof actionSchema>;

export type LuckyAnimalState = {
  settings: LuckyAnimalSettings;
  rounds: { drawId: string; winners: string[]; mode: string }[];
  excluded: string[];
};

export type LuckyAnimalView = LuckyAnimalState;

export const activity: ActivityDefinition<
  LuckyAnimalSettings,
  LuckyAnimalState,
  LuckyAnimalAction,
  LuckyAnimalView
> = {
  meta: { id: 'lucky-animal', i18nKey: 'office.activities.lucky-animal', maxParticipants: 200, modes: MODES },
  settingsSchema,
  actionSchema,
  setup: (settings) => ({ settings, rounds: [], excluded: [] }),
  validate(_state, actor) {
    if (!actor.isHost) return { ok: false, code: 'office.not_host' };
    return { ok: true };
  },
  apply(state, _actor, action) {
    const patch = Object.fromEntries(Object.entries(action.patch).filter(([, v]) => v !== undefined));
    return { state: { ...state, settings: { ...state.settings, ...patch } } };
  },
  onDrawResult(state, result) {
    return {
      ...state,
      rounds: [...state.rounds, { drawId: result.drawId, winners: result.winners, mode: result.mode }],
      excluded: state.settings.excludePrevious ? [...state.excluded, ...result.winners] : state.excluded,
    };
  },
  // Nothing is hidden: every screen sees the same.
  view: (state) => state,
};
