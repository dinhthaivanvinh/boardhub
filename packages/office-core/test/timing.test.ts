import { describe, expect, it } from 'vitest';
import { DRAW_BUILD_UP_MS, DRAW_LANDING_MS, DRAW_REVEAL_LEAD_MS, DRAW_START_DELAY_MS } from '../src/timing';

describe('draw timing', () => {
  it('the result leaves the server during the build-up, never before it starts', () => {
    expect(DRAW_REVEAL_LEAD_MS).toBeGreaterThan(0);
    expect(DRAW_REVEAL_LEAD_MS).toBeLessThan(DRAW_BUILD_UP_MS);
    expect(DRAW_START_DELAY_MS).toBeGreaterThan(0);
    expect(DRAW_LANDING_MS).toBeGreaterThan(0);
  });
});
