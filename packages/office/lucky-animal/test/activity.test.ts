import { describe, expect, it } from 'vitest';
import { activity, settingsSchema } from '../src/activity';

const ctx = { participants: [], hostId: 'h', now: 0 };
const host = { id: 'h', isHost: true };
const guest = { id: 'g', isHost: false };

describe('lucky-animal (O2: settings)', () => {
  it('defaults', () => {
    expect(settingsSchema.parse({})).toEqual({
      mode: 'race',
      n: 1,
      excludePrevious: true,
      hostParticipates: false,
    });
    expect(settingsSchema.safeParse({ title: 'x' }).success).toBe(false); // the title belongs to the session
  });

  it('only the host configures; settings are validated', () => {
    const s = activity.setup(settingsSchema.parse({}));
    const action = { kind: 'configure' as const, patch: { n: 3 } };
    expect(activity.validate(s, guest, action, ctx)).toEqual({ ok: false, code: 'office.not_host' });
    expect(activity.validate(s, host, action, ctx)).toEqual({ ok: true });
    expect(activity.apply(s, host, action, ctx).state.settings.n).toBe(3);
    expect(activity.actionSchema.safeParse({ kind: 'configure', patch: { n: 50 } }).success).toBe(false);
    expect(activity.view(s, 'stage', null, ctx)).toEqual(s);
  });

  it('records draw results and exclusions', () => {
    const s = activity.setup(settingsSchema.parse({}));
    const after = activity.onDrawResult(s, { drawId: 'd1', mode: 'race', winners: ['a'] }, ctx);
    expect(after.rounds).toEqual([{ drawId: 'd1', winners: ['a'], mode: 'race' }]);
    expect(after.excluded).toEqual(['a']);
    const keep = activity.setup(settingsSchema.parse({ excludePrevious: false }));
    expect(activity.onDrawResult(keep, { drawId: 'd1', mode: 'race', winners: ['a'] }, ctx).excluded).toEqual(
      [],
    );
  });
});
