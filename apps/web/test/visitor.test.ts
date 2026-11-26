import { describe, expect, it } from 'vitest';
import { doneKind } from '../src/features/stats/learn-ping';
import { SESSION_GAP_MS, touchSession, visitorId } from '../src/features/stats/visitor';

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('visitor', () => {
  it('keeps one random id per browser', () => {
    const store = memory();
    const id = visitorId(store);
    expect(id).toMatch(/^[A-Za-z0-9-]{16,64}$/);
    expect(visitorId(store)).toBe(id);
  });

  it('starts a new session only after 30 minutes away', () => {
    const store = memory();
    const start = 1_000_000;
    expect(touchSession(start, store)).toBe(true);
    expect(touchSession(start + SESSION_GAP_MS - 1, store)).toBe(false);
    // measured from the last use, not from the start of the session
    expect(touchSession(start + 2 * SESSION_GAP_MS - 2, store)).toBe(false);
    expect(touchSession(start + 3 * SESSION_GAP_MS, store)).toBe(true);
  });

  it('tells a practice from a lesson by its id', () => {
    expect(doneKind('practice-pawn')).toBe('practice');
    expect(doneKind('pawn')).toBe('lesson');
  });
});
