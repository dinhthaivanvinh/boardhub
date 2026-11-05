import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Board tests render with jsdom; on a busy 2-core CI runner one can take several seconds.
    testTimeout: 20_000,
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
