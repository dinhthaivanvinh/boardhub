import { expect, test, type Page } from '@playwright/test';

/** Speech is not under test here: a silent stub keeps the practice from waiting on audio. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'learn.chess.voice.v1',
      JSON.stringify({ lang: 'vi', auto: false, results: false }),
    );
  });
});

const status = (page: Page) => page.locator('[role="status"]').first();

/** Answers the question on the screen the way a child would: ask for the hint(s), then do what they say. */
async function solveRound(page: Page) {
  const hint = page.getByRole('button', { name: /Gợi ý/ });
  const prompt = await page.getByTestId('mate-prompt').innerText();
  await hint.click();
  const first = await status(page).innerText();
  const from = /ô ([a-h][1-8])/.exec(first)?.[1];
  expect(from, `the first hint names a square: ${first}`).toBeTruthy();
  if (/ngôi sao/.test(prompt)) {
    await page.locator(`[data-square="${from}"]`).click();
    return;
  }
  await hint.click();
  const to = /tới ô ([a-h][1-8])/.exec(await status(page).innerText())?.[1];
  expect(to, 'the second hint names the target').toBeTruthy();
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
}

async function solveAll(page: Page, rounds: number) {
  for (let i = 1; i <= rounds; i++) {
    await expect(page.getByTestId('mate-prompt')).toContainText(`${i}/${rounds}`);
    await solveRound(page);
  }
}

test('the practice of a piece lesson can be played to the end and earns stars', async ({ page }) => {
  await page.goto('/learn/chess/rook/practice');
  await expect(page.getByRole('heading', { level: 2, name: /Luyện tập: Xe/ })).toBeVisible();
  await solveAll(page, 5);
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(page.getByText('Bạn đã luyện tập xong! Được thêm 2 ⭐.')).toBeVisible();

  await page.getByTestId('practice-back').click();
  await expect(page).toHaveURL(/\/learn\/chess\/rook$/);

  await page.goto('/journey');
  await expect(page.getByTestId('stat-stars')).toHaveText('2 ⭐');
  await expect(page.getByRole('link', { name: /Xe/ }).getByText('Đã luyện tập')).toBeAttached();
});

test('an opening and a special move have a practice too', async ({ page }) => {
  await page.goto('/learn/chess/london/practice');
  await solveAll(page, 5);
  await expect(page.getByRole('button', { name: 'Tiếp tục' })).toBeVisible();

  await page.goto('/learn/chess/castling/practice');
  await solveAll(page, 5);
  await expect(page.getByRole('button', { name: 'Tiếp tục' })).toBeVisible();
});

test('a lesson without a practice has no such page', async ({ page }) => {
  const res = await page.goto('/learn/chess/coordinates/practice');
  expect(res?.status()).toBe(404);
});

test('a finished lesson offers its practice before the next lesson', async ({ page }) => {
  await page.goto('/learn/chess/castling');
  await page.getByRole('button', { name: /Tiếp tục/ }).click(); // meet
  await page.getByRole('button', { name: /Tiếp tục/ }).click(); // watch
  await page.locator('[data-square="e1"]').click(); // try: castle queenside
  await page.locator('[data-square="c1"]').click();
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  const practice = page.getByTestId('practice-link');
  await expect(practice).toHaveAttribute('href', '/learn/chess/castling/practice');
  await expect(practice).toContainText('Luyện tập');
  // Practice first, then on to the next lesson (not the other way round).
  const buttons = page.locator('.ch-done-actions a');
  await expect(buttons.first()).toHaveAttribute('data-testid', 'practice-link');
  await practice.click();
  await expect(page).toHaveURL(/\/learn\/chess\/castling\/practice$/);
});
