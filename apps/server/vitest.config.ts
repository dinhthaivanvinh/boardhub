import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Board tests render with jsdom; on a busy 2-core CI runner one can take several seconds.
    testTimeout: 20_000,
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/bots/bot-worker.ts'],
      thresholds: { lines: 75 },
    },
  },
});
