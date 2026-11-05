import { expect, test, type Page } from '@playwright/test';

const status = (page: Page) => page.getByRole('status').first();

test('the home page lists the MVP games and nothing "coming soon"', async ({ page }) => {
  await page.goto('/board-games');
  for (const name of ['Caro', 'Bốn trong hàng', 'Reversi', 'Cờ tướng']) {
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.getByText('Sắp ra mắt')).toHaveCount(0);
});

test.describe('Reversi', () => {
  const cell = (page: Page, row: number, col: number) =>
    page.getByRole('gridcell', { name: new RegExp(`^Hàng ${row}, cột ${col}:`) });

  test('a move flips a disc and passes the turn', async ({ page }) => {
    await page.goto('/play/reversi?mode=local');
    await expect(page.getByLabel('Đen 2, Trắng 2')).toBeVisible();
    await expect(page.locator('[data-legal="true"]')).toHaveCount(4);
    await cell(page, 3, 4).click(); // Black on (2,3): flips (3,3)
    await expect(cell(page, 4, 4)).toHaveAttribute('data-piece', 'p0');
    await expect(page.getByLabel('Đen 4, Trắng 1')).toBeVisible();
    await expect(status(page)).toHaveText('Lượt của Trắng · Người chơi 2');
  });

  test('the computer answers', async ({ page }) => {
    await page.goto('/play/reversi?mode=bot&level=easy');
    await cell(page, 3, 4).click();
    await expect(page.locator('[data-piece="p1"]')).not.toHaveCount(1, { timeout: 10_000 });
    await expect(status(page)).toHaveText('Lượt của Đen · Bạn');
  });
});

test.describe('Cờ tướng', () => {
  // Displayed coordinates: column 1..9 left to right, row 1..10 from the bottom.
  const point = (page: Page, col: number, row: number) =>
    page.getByRole('gridcell', { name: new RegExp(`^Cột ${col}, hàng ${row}:`) });

  test('select the cannon, move it to the centre file', async ({ page }) => {
    await page.goto('/play/xiangqi?mode=local');
    await point(page, 2, 3).click();
    await expect(point(page, 2, 3)).toHaveAttribute('data-selected', 'true');
    await point(page, 5, 3).click();
    await expect(point(page, 5, 3)).toHaveAttribute('data-piece', 'rC');
    await expect(status(page)).toHaveText('Lượt của Đen · Người chơi 2');
  });

  test('playing Black against the computer: the board is turned and the computer opens', async ({ page }) => {
    await page.goto('/play/xiangqi?mode=bot&level=easy&side=1');
    // Black's general is at the bottom for the Black player.
    await expect(point(page, 5, 1)).toHaveAttribute('data-piece', 'bK');
    await expect(status(page)).toHaveText('Lượt của Đen · Bạn', { timeout: 15_000 });
  });
});
