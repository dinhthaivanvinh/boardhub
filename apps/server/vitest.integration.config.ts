import { defineConfig } from 'vitest/config';

// Needs real services: `docker compose up -d`, then REDIS_URL and DATABASE_URL (defaults below match docker-compose.yml).
export default defineConfig({
  test: {
    include: ['test/**/*.integration.test.ts'],
    testTimeout: 20_000,
    env: {
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://boardhub:boardhub@localhost:5432/boardhub',
    },
  },
});
