import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3123);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    // Most tests play as a fresh guest without being asked first (the "remember" choice of the
    // account dialog); e2e/auth-prompt.spec.ts clears this to test the question itself.
    storageState: {
      cookies: [],
      origins: [{ origin: BASE_URL, localStorage: [{ name: 'bg-auth-choice', value: 'guest' }] }],
    },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: `pnpm --filter @bg/web build && pnpm --filter @bg/web exec next start --port ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      // The web app looks for the game server on port 4000 of the same host. In memory, short bot delay.
      command: 'pnpm --filter @bg/server start',
      url: 'http://localhost:4000/health',
      env: { PORT: '4000', LOG_LEVEL: 'warn', BOT_DELAY_MS: '100', ADMIN_EMAILS: 'admin-e2e@example.com' },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
