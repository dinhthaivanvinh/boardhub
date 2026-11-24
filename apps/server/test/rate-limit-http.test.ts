import { afterAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/app';
import { loadConfig } from '../src/config';

describe('limits on sign-in, sign-up and guest requests', () => {
  const ready = buildServer(loadConfig({ LOG_LEVEL: 'silent', BOT_WORKERS: '0', AUTH_RATE_LIMIT: '3' }));
  afterAll(async () => (await ready).close());

  const post = async (url: string, payload: object) =>
    (await (await ready).app.inject({ method: 'POST', url, payload })).statusCode;

  it('answers 429 once an address has used up its minute, for each of the three', async () => {
    const login = { email: 'nobody@example.com', password: 'wrong-pass-1' };
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push(await post('/api/auth/login', login));
    expect(codes.slice(0, 3)).toEqual([401, 401, 401]);
    expect(codes.slice(3)).toEqual([429, 429]);
    // The limit is counted per route, so guests still get in.
    expect(await post('/api/auth/guest', { displayName: 'Bé' })).toBe(200);
  });

  it('leaves the rest of the API alone', async () => {
    const app = (await ready).app;
    for (let i = 0; i < 10; i++)
      expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
  });
});
