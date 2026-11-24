import { expect, test } from '@playwright/test';

const API = process.env.E2E_SERVER_URL ?? 'http://localhost:4000';

type Guest = { token: string; user: unknown };

/** A browser that is already signed in as the given account (what a second device looks like after login). */
const session = (g: Guest) => ({
  key: 'bg-session',
  value: JSON.stringify({ state: { token: g.token, user: g.user }, version: 0 }),
});

test.describe('the journey follows the account', () => {
  test.skip(({ isMobile }) => isMobile, 'same logic on both; one run is enough');

  test('without an account the journey offers to be saved, and the button opens the sign-in dialog', async ({
    page,
  }) => {
    await page.goto('/journey');
    await expect(page.getByTestId('save-progress')).toHaveAttribute('data-state', 'none');
    await page.getByTestId('save-progress-button').click();
    await expect(page.getByTestId('auth-prompt')).toBeVisible();
  });

  test('progress saved on one device shows up on another, and nothing is lost either way', async ({
    browser,
    request,
  }) => {
    const guest = (await (await request.post(`${API}/api/auth/guest`, { data: {} })).json()) as Guest;
    const { key, value } = session(guest);

    // Device A: signed in, has done two lessons and one puzzle.
    const a = await browser.newContext();
    await a.addInitScript(
      ([k, v]) => {
        window.localStorage.setItem(k!, v!);
        window.localStorage.setItem('learn.chess.v1', JSON.stringify(['coordinates', 'pawn']));
        window.localStorage.setItem(
          'learn.chess.puzzles.v1',
          JSON.stringify({ solved: ['t1-01'], days: ['2026-03-01'], daily: [] }),
        );
      },
      [key, value],
    );
    const pageA = await a.newPage();
    await pageA.goto('/journey');
    await expect(pageA.getByTestId('stat-stars')).toHaveText('7 ⭐');
    await expect
      .poll(async () => {
        const res = await request.get(`${API}/api/me/progress`, {
          headers: { authorization: `Bearer ${guest.token}` },
        });
        return ((await res.json()) as { progress: { lessons: string[] } }).progress.lessons.sort();
      })
      .toEqual(['coordinates', 'pawn']);
    await a.close();

    // Device B: the same account, with one different lesson and puzzle done offline.
    const b = await browser.newContext();
    await b.addInitScript(
      ([k, v]) => {
        window.localStorage.setItem(k!, v!);
        window.localStorage.setItem('learn.chess.v1', JSON.stringify(['rook']));
        window.localStorage.setItem(
          'learn.chess.puzzles.v1',
          JSON.stringify({ solved: ['t1-02'], days: ['2026-03-02'], daily: [] }),
        );
      },
      [key, value],
    );
    const pageB = await b.newPage();
    await pageB.goto('/journey');
    // 3 lessons (coordinates, pawn, rook) x 3 stars + 2 puzzles.
    await expect(pageB.getByTestId('stat-stars')).toHaveText('11 ⭐');
    const stored = await pageB.evaluate(() => ({
      lessons: JSON.parse(window.localStorage.getItem('learn.chess.v1') ?? '[]') as string[],
    }));
    expect(stored.lessons.sort()).toEqual(['coordinates', 'pawn', 'rook']);

    // And the account holds all of it.
    await expect
      .poll(async () => {
        const res = await request.get(`${API}/api/me/progress`, {
          headers: { authorization: `Bearer ${guest.token}` },
        });
        const p = ((await res.json()) as { progress: { lessons: string[]; puzzles: string[] } }).progress;
        return [p.lessons.sort(), p.puzzles.sort()];
      })
      .toEqual([
        ['coordinates', 'pawn', 'rook'],
        ['t1-01', 't1-02'],
      ]);
    await b.close();
  });

  test('a guest account is told to register; a registered one sees that the journey is saved', async ({
    browser,
    request,
  }) => {
    const guest = (await (await request.post(`${API}/api/auth/guest`, { data: {} })).json()) as Guest;
    const ctx = await browser.newContext();
    const { key, value } = session(guest);
    await ctx.addInitScript(([k, v]) => window.localStorage.setItem(k!, v!), [key, value]);
    const page = await ctx.newPage();
    await page.goto('/journey');
    await expect(page.getByTestId('save-progress')).toHaveAttribute('data-state', 'guest');
    await expect(page.getByTestId('save-progress-register')).toHaveAttribute('href', '/account');
    await ctx.close();

    const email = `be-${Date.now()}@example.com`;
    const registered = (await (
      await request.post(`${API}/api/auth/register`, {
        data: { email, password: 'matkhau-an-toan', displayName: 'Bé An' },
      })
    ).json()) as Guest;
    const ctx2 = await browser.newContext();
    const s2 = session(registered);
    await ctx2.addInitScript(([k, v]) => window.localStorage.setItem(k!, v!), [s2.key, s2.value]);
    const page2 = await ctx2.newPage();
    await page2.goto('/journey');
    await expect(page2.getByTestId('save-progress')).toHaveAttribute('data-state', 'saved');
    await expect(page2.getByTestId('save-progress')).toContainText('Bé An');
    await ctx2.close();
  });
});
