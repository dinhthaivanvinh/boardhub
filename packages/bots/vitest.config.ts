import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Board tests render with jsdom; on a busy 2-core CI runner one can take several seconds.
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      thresholds: { lines: 85 },
    },
  },
});
