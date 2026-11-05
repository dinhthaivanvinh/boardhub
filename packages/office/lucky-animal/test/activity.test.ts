import { describe, expect, it } from 'vitest';
import type { ActivityContext, Participant } from '@bg/office-core';
import { defaultAvatar } from '@bg/avatars/random';
import { activity, candidatesOf, settingsSchema } from '../src/activity';

const person = (id: string): Participant => ({
  id,
  name: id,
  avatar: defaultAvatar(id),
  online: true,
  joinedAt: 0,
  absent: false,
});
const ctxWith = (ids: string[], hostId = 'h'): ActivityContext => ({
  participants: ids.map(person),
  hostId,
  now: 0,
});
const host = { id: 'h', isHost: true };
const guest = { id: 'a', isHost: false };
const fresh = (settings: object = {}) => activity.setup(settingsSchema.parse(settings));

describe('lucky-animal', () => {
  it('defaults', () => {
    expect(settingsSchema.parse({})).toEqual({
      mode: 'race',
      n: 1,
      excludePrevious: true,
      hostParticipates: false,
    });
    expect(settingsSchema.safeParse({ title: 'x' }).success).toBe(false); // the title belongs to the session
  });

  it('only the host acts; settings are validated', () => {
    const s = fresh();
    const ctx = ctxWith(['a', 'b']);
    const action = { kind: 'configure' as const, patch: { n: 2 } };
    expect(activity.validate(s, guest, action, ctx)).toEqual({ ok: false, code: 'office.not_host' });
    expect(activity.validate(s, guest, { kind: 'draw' }, ctx)).toEqual({
      ok: false,
      code: 'office.not_host',
    });
    expect(activity.apply(s, host, action, ctx).state.settings.n).toBe(2);
    expect(activity.actionSchema.safeParse({ kind: 'configure', patch: { n: 50 } }).success).toBe(false);
  });

  it('a draw asks the hub to pick from everyone but the host', () => {
    const s = fresh({ n: 2, mode: 'wheel' });
    const ctx = ctxWith(['b', 'h', 'a', 'c']);
    expect(activity.validate(s, host, { kind: 'draw' }, ctx)).toEqual({ ok: true });
    const { state, draw } = activity.apply(s, host, { kind: 'draw' }, ctx);
    expect(state).toBe(s); // nothing changes until the result comes back
    expect(draw).toEqual({ n: 2, candidates: ['b', 'a', 'c'], mode: 'wheel' });
    expect(activity.view(s, 'stage', null, ctx).candidates).toBe(3);
    // The host joins in when asked to.
    expect(candidatesOf(fresh({ hostParticipates: true }), ctx)).toContain('h');
  });

  it('not enough people: refused', () => {
    expect(activity.validate(fresh({ n: 3 }), host, { kind: 'draw' }, ctxWith(['a', 'b']))).toEqual({
      ok: false,
      code: 'office.not_enough',
    });
  });

  it('winners are left out of later draws until exclusions are reset', () => {
    const ctx = ctxWith(['a', 'b', 'c']);
    let s = activity.onDrawResult(fresh(), { drawId: 'd1', mode: 'race', winners: ['a'] }, ctx);
    expect(s.rounds).toEqual([{ drawId: 'd1', winners: ['a'], mode: 'race' }]);
    expect(candidatesOf(s, ctx)).toEqual(['b', 'c']);
    s = activity.apply(s, host, { kind: 'reset-exclusions' }, ctx).state;
    expect(candidatesOf(s, ctx)).toEqual(['a', 'b', 'c']);
    expect(s.rounds).toHaveLength(1);

    const keep = fresh({ excludePrevious: false });
    expect(activity.onDrawResult(keep, { drawId: 'd1', mode: 'race', winners: ['a'] }, ctx).excluded).toEqual(
      [],
    );
  });

  it('five people, five draws: everyone exactly once, then nobody left', () => {
    const ctx = ctxWith(['a', 'b', 'c', 'd', 'e']);
    let s = fresh();
    const picked: string[] = [];
    for (let i = 0; i < 5; i++) {
      const { draw } = activity.apply(s, host, { kind: 'draw' }, ctx);
      const winner = draw!.candidates[0]!;
      picked.push(winner);
      s = activity.onDrawResult(s, { drawId: `d${i}`, mode: 'race', winners: [winner] }, ctx);
    }
    expect([...picked].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(activity.validate(s, host, { kind: 'draw' }, ctx)).toEqual({
      ok: false,
      code: 'office.not_enough',
    });
  });
});
