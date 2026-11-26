import { expect, test, type Page } from '@playwright/test';

/** The little games: reached from the home, journey and puzzle pages; each opens, fits and can be played. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('learn.chess.voice.v1', JSON.stringify({ auto: false, results: false }));
  });
});

const square = (page: Page, name: string) => page.locator(`[data-square="${name}"]`);

test('the little games are reached from the home, journey and puzzle pages', async ({ page }) => {
  for (const [from, link] of [
    ['/', 'home-mini-go'],
    ['/journey', 'journey-mini'],
  ]) {
    await page.goto(from!);
    await page.getByTestId(link!).click();
    await expect(page).toHaveURL(/\/mini-games$/);
  }
  await page.goto('/puzzles');
  await page.getByRole('link', { name: /Trò chơi nhỏ/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Trò chơi nhỏ' })).toBeVisible();
});

test('winning a level gives stars that are remembered', async ({ page }) => {
  await page.goto('/mini-games');
  await expect(page.getByTestId('mini-stars-knight-stars')).toHaveText('0/24 ⭐');
  await page.getByTestId('mini-knight-stars').click();
  await square(page, 'b1').click();
  await square(page, 'c3').click();
  await expect(page.getByTestId('mini-end')).toHaveAttribute('data-stars', '3');
  await page.getByRole('button', { name: 'Màn tiếp theo' }).click();
  await expect(page.getByTestId('mini-level-2')).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/mini-games');
  await expect(page.getByTestId('mini-stars-knight-stars')).toHaveText('3/24 ⭐');
  await page.reload();
  await expect(page.getByTestId('mini-stars-knight-stars')).toHaveText('3/24 ⭐');
});

for (const game of ['knight-stars', 'rook-wall', 'pawn-race']) {
  test(`${game}: opens, has no errors, no sideways scroll, and the hint can be played`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/mini-games/${game}`);
    await expect(page.getByRole('grid')).toBeVisible();
    const wider = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(wider).toBeLessThanOrEqual(1);

    const hint = page.getByRole('button', { name: /Gợi ý/ });
    await hint.click();
    await hint.click();
    const line = page.locator('.stage-aside [role="status"]').first();
    await expect(line).toContainText(/tới ô [a-h][1-8]/);
    const text = await line.innerText();
    await square(page, /ô ([a-h][1-8])/.exec(text)![1]!).click();
    await square(page, /tới ô ([a-h][1-8])/.exec(text)![1]!).click();
    await expect(page.getByTestId('mini-moves')).toContainText('1');
    expect(errors).toEqual([]);
  });
}

test('an unknown game is not found', async ({ page }) => {
  const res = await page.goto('/mini-games/nope');
  expect(res!.status()).toBe(404);
});
