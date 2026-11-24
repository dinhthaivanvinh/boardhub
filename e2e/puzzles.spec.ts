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

  await solvePuzzle(page);
  await expect(page.getByTestId('puzzle-after')).toContainText('1 ⭐');

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
  await page.getByTestId('helper-puzzle').click();
  await expect(page).toHaveURL(/\/puzzles\/daily$/);
  await expect(page.getByRole('grid')).toBeVisible();
  await solvePuzzle(page);

  await page.goto('/puzzles');
  await expect(page.getByText('Bạn đã giải câu đố hôm nay rồi. Mai quay lại nhé!')).toBeVisible();
});

test('the home helper tells a newcomer to start, then points at the next lesson', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home-helper-line')).toContainText('chú Mã');
  await expect(page.getByTestId('helper-learn')).toHaveAttribute('href', '/learn/chess/coordinates');

  await page.evaluate(() => window.localStorage.setItem('learn.chess.v1', JSON.stringify(['coordinates'])));
  await page.reload();
  await expect(page.getByTestId('helper-learn')).toHaveAttribute('href', '/learn/chess/pawn');
  await expect(page.getByTestId('home-helper-line')).toContainText('học bài');
  await expect(page.getByTestId('stat-stars')).toHaveText('3 ⭐');
});

test('the journey shows the next lesson, the stages and the badges earned', async ({ page }) => {
  await page.goto('/journey');
  await expect(page.getByRole('heading', { level: 1, name: /Hành trình/ })).toBeVisible();
  await expect(page.getByTestId('journey-continue')).toHaveAttribute('href', '/learn/chess/coordinates');
  await expect(page.getByTestId('journey-badge-count')).toHaveText('Đã được 0/14 huy hiệu');

  const all = [
    'coordinates',
    'pawn',
    'rook',
    'bishop',
    'knight',
    'queen',
    'king',
    'capture',
    'checkmate',
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
  await page.evaluate((ids) => window.localStorage.setItem('learn.chess.v1', JSON.stringify(ids)), all);
  await page.reload();
  await expect(page.getByTestId('journey-continue')).toHaveCount(0);
  await expect(page.getByTestId('journey-badge-count')).toHaveText('Đã được 8/14 huy hiệu');
  await expect(page.getByTestId('stat-stars')).toHaveText('57 ⭐');
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
