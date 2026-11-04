import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3123);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
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
      env: { PORT: '4000', LOG_LEVEL: 'warn', BOT_DELAY_MS: '100' },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
