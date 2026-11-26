import { expect, test, type Page } from '@playwright/test';

/** Speech is not under test here: a silent stub keeps the puzzles from waiting on audio. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem('learn.chess.voice.v1')) {
      window.localStorage.setItem(
        'learn.chess.voice.v1',
        JSON.stringify({ lang: 'vi', auto: false, results: false }),
      );
    }
  });
});

/** Solves the puzzle on the screen the way a child would: ask for the two hints, then play what they say. */
async function solvePuzzle(page: Page) {
  const hint = page.getByRole('button', { name: /Gợi ý/ });
  await hint.click();
  const from = /ở ô ([a-h][1-8])/.exec(
    await page.locator('.ch-learn-status, [role="status"]').first().innerText(),
  )?.[1];
  expect(from, 'the first hint names the piece').toBeTruthy();
  await hint.click();
  const text = await page.locator('.ch-learn-status, [role="status"]').first().innerText();
  const to = /tới ô ([a-h][1-8])/.exec(text)?.[1];
  expect(to, 'the second hint names the square').toBeTruthy();
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
  await expect(page.getByTestId('puzzle-after')).toBeVisible();
}

test('the puzzles page offers the puzzle of the day and three levels', async ({ page }) => {
  await page.goto('/puzzles');
  await expect(page.getByRole('heading', { level: 1, name: /Câu đố cờ vua/ })).toBeVisible();
  await expect(page.getByTestId('puzzle-daily')).toBeEnabled();
  for (const tier of [1, 2, 3]) await expect(page.getByTestId(`puzzle-tier-${tier}`)).toBeVisible();
  await expect(page.getByTestId('stat-stars')).toHaveText('0 ⭐');
});

test('solving a puzzle earns a star, a streak day, and is remembered', async ({ page }) => {
  await page.goto('/puzzles');
  await page.getByTestId('puzzle-tier-1').click();
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.getByRole('grid').getByRole('gridcell')).toHaveCount(64);

  // The server is told what was just solved, for the learning statistics, with or without an account.
  const counted = page.waitForResponse((r) => r.url().endsWith('/api/learn-events'));
  await solvePuzzle(page);
  await expect(page.getByTestId('puzzle-after')).toContainText('1 ⭐');
  const ping = await counted;
  expect(ping.status()).toBe(200);
  expect(ping.request().postDataJSON()).toMatchObject({
    kind: 'puzzle',
    itemId: expect.stringMatching(/^t1-/),
  });

  await page.getByRole('button', { name: 'Về danh sách câu đố' }).first().click();
  await expect(page.getByTestId('stat-stars')).toHaveText('1 ⭐');
  await expect(page.getByTestId('stat-streak')).toContainText('1 ngày liên tiếp');
  await expect(page.getByText('Đã giải 1/50 câu')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('stat-stars')).toHaveText('1 ⭐');
  await expect(page.getByTestId('puzzle-tier-1')).toHaveText('Chơi tiếp');
});

test('the next puzzle button moves to a different position', async ({ page }) => {
  await page.goto('/puzzles');
  await page.getByTestId('puzzle-tier-1').click();
  const before = await page.getByRole('grid').innerHTML();
  await solvePuzzle(page);
  await page.getByRole('button', { name: 'Câu tiếp theo' }).click();
  await expect(page.getByTestId('puzzle-after')).toHaveCount(0);
  expect(await page.getByRole('grid').innerHTML()).not.toBe(before);
});

test('the puzzle of the day opens straight from the home page and is marked done', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('daily-go').click();
  await expect(page).toHaveURL(/\/puzzles\/daily$/);
  await expect(page.getByRole('grid')).toBeVisible();
  await solvePuzzle(page);

  await page.goto('/puzzles');
  await expect(page.getByText('Bạn đã giải câu đố hôm nay rồi. Mai quay lại nhé!')).toBeVisible();
});

test('the home learn button starts a newcomer and then carries on with the next lesson', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('cta-learn')).toHaveAttribute('href', '/learn/chess/coordinates');
  await expect(page.getByTestId('cta-learn')).toHaveText('Bắt đầu học ngay');

  await page.evaluate(() => window.localStorage.setItem('learn.chess.v1', JSON.stringify(['coordinates'])));
  await page.reload();
  await expect(page.getByTestId('cta-learn')).toHaveAttribute('href', '/learn/chess/setup');
  await expect(page.getByTestId('cta-learn')).toHaveText('Học tiếp');
  await expect(page.getByTestId('ach-stars')).toContainText('3');
});

test('the journey shows the next lesson, the stages and the badges earned', async ({ page }) => {
  await page.goto('/journey');
  await expect(page.getByRole('heading', { level: 1, name: /Hành trình/ })).toBeVisible();
  await expect(page.getByTestId('journey-continue')).toHaveAttribute('href', '/learn/chess/coordinates');
  await expect(page.getByTestId('journey-badge-count')).toHaveText('Đã được 0/14 huy hiệu');

  const all = [
    'coordinates',
    'setup',
    'pawn',
    'rook',
    'bishop',
    'knight',
    'queen',
    'king',
    'capture',
    'checkmate',
    'draws',
    'italian',
    'queens-gambit',
    'london',
    'ruy-lopez',
    'sicilian',
    'french',
    'castling',
    'en-passant',
    'promotion',
    'tactics',
  ];
  const finish = async (ids: string[]) => {
    await page.evaluate((v) => window.localStorage.setItem('learn.chess.v1', JSON.stringify(v)), ids);
    await page.reload();
  };
  // These 21 were every lesson when the "master" badge was first given: it stays, with newer lessons to do.
  await finish(all);
  await expect(page.getByTestId('journey-continue')).toHaveAttribute('href', '/learn/chess/basic-mates');
  await expect(page.getByTestId('journey-badge-count')).toHaveText('Đã được 8/14 huy hiệu');
  await expect(page.getByTestId('stat-stars')).toHaveText('63 ⭐');

  await finish([...all, 'basic-mates', 'opening-basics', 'early-mate']);
  await expect(page.getByTestId('journey-continue')).toHaveCount(0);
  await expect(page.getByTestId('journey-badge-count')).toHaveText('Đã được 8/14 huy hiệu');
  await expect(page.getByTestId('stat-stars')).toHaveText('72 ⭐');
});

test('the header links to the puzzles and the journey', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) await page.getByRole('button', { name: 'Menu' }).click();
  const scope = isMobile ? page.locator('#mobile-nav') : page.getByRole('navigation', { name: 'Điều hướng' });
  await scope.getByRole('link', { name: 'Câu đố' }).click();
  await expect(page).toHaveURL(/\/puzzles$/);
  if (isMobile) await page.getByRole('button', { name: 'Menu' }).click();
  await scope.getByRole('link', { name: 'Hành trình' }).click();
  await expect(page).toHaveURL(/\/journey$/);
});

test('the adventure map and the achievements on the home page follow the real progress', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.adv-place')).toHaveCount(8);
  await expect(page.getByTestId('ach-stars')).toContainText('0');

  await page.evaluate(() => window.localStorage.setItem('learn.chess.v1', JSON.stringify(['coordinates'])));
  await page.reload();
  const first = page.locator('.adv-place').first();
  await expect(first).toHaveAttribute('data-state', 'doing');
  await expect(first).toContainText('1/2 bài');
  await expect(first.getByRole('link')).toHaveAttribute('href', '/learn/chess/setup');
  await expect(page.getByTestId('ach-stars')).toContainText('3');
  await expect(page.getByTestId('ach-lessons')).toContainText('1/24');
});

test('the home page does not scroll sideways', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const wider = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(wider).toBe(false);
});
