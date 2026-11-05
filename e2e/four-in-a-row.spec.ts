import { expect, test, type Page } from '@playwright/test';

// Cells are labelled "Cột {col}, hàng {row}: {piece}" (1-based, rows counted from the bottom).
const cell = (page: Page, col: number, row: number) =>
  page.getByRole('gridcell', { name: new RegExp(`^Cột ${col}, hàng ${row}:`) });
const status = (page: Page) => page.getByRole('status').first();

test('the home page lists Four in a Row as playable', async ({ page }) => {
  await page.goto('/board-games');
  await page.getByRole('link', { name: /Bốn trong hàng/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Bốn trong hàng' })).toBeVisible();
  await expect(page.getByLabel('Số cột')).toHaveValue('7');
});

test('two players on one device: a vertical four wins', async ({ page }) => {
  await page.goto('/play/four-in-a-row?mode=local');
  await expect(status(page)).toHaveText('Lượt của Vàng · Người chơi 1');

  // Clicking the top hole of a column drops the piece to the bottom.
  for (const col of [1, 2, 1, 2, 1, 2]) await cell(page, col, 6).click();
  await expect(cell(page, 1, 3)).toHaveAttribute('data-piece', 'p0');
  await cell(page, 1, 6).click();

  await expect(status(page)).toHaveText('Vàng · Người chơi 1 thắng (4 quân liên tiếp)');
  await expect(page.locator('[data-win="true"]')).toHaveCount(4);
});

test('the computer answers a move', async ({ page }) => {
  await page.goto('/play/four-in-a-row?mode=bot&level=easy');
  await cell(page, 4, 6).click();
  await expect(cell(page, 4, 1)).toHaveAttribute('data-piece', 'p0');
  await expect(page.locator('[data-piece="p1"]')).toHaveCount(1, { timeout: 10_000 });
  await expect(status(page)).toHaveText('Lượt của Vàng · Bạn');
});
