import type { z } from 'zod';
import type { Avatar as AvatarData } from '@bg/avatars/schema';

/** Contract of an office activity (docs/office/04-activity-spec.md, ADR-0005). */

export type Screen = 'host' | 'stage' | 'participant';

export interface Participant {
  /** userId, or "absent:<id>" for someone the host added. */
  id: string;
  name: string;
  avatar: AvatarData;
  online: boolean;
  /** Server time (ms), only used to order the display. */
  joinedAt: number;
  /** Added by the host for someone without a phone. */
  absent: boolean;
}

export interface ActivityContext {
  /** Ordered by id. The hub is the source of truth (rule A7). */
  participants: readonly Participant[];
  hostId: string;
  /** Server time (ms) passed in by the hub (rule A1). */
  now: number;
}

export interface Actor {
  id: string;
  isHost: boolean;
}

export type Check = { ok: true } | { ok: false; code: string };

/** An activity asks the hub for a draw; it never picks at random itself (rule A5). */
export interface DrawRequest {
  n: number;
  candidates: string[];
  mode: string;
}

export interface DrawResult {
  drawId: string;
  mode: string;
  winners: string[];
}

export interface ActivityDefinition<Settings, State, Action, View> {
  meta: { id: string; i18nKey: string; maxParticipants: number; modes: readonly string[] };
  settingsSchema: z.ZodType<Settings>;
  actionSchema: z.ZodType<Action>;
  setup(settings: Settings): State;
  validate(state: State, actor: Actor, action: Action, ctx: ActivityContext): Check;
  apply(
    state: State,
    actor: Actor,
    action: Action,
    ctx: ActivityContext,
  ): { state: State; draw?: DrawRequest };
  onDrawResult(state: State, result: DrawResult, ctx: ActivityContext): State;
  onParticipantsChanged?(state: State, ctx: ActivityContext): State;
  /** What one screen may see (rule A4). */
  view(state: State, screen: Screen, viewerId: string | null, ctx: ActivityContext): View;
}

/** Erased type for registries holding many activities. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyActivityDefinition = ActivityDefinition<any, any, any, any>;
