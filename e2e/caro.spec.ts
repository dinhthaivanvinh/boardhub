import { expect, test, type Page } from '@playwright/test';

// Cells are labelled "Hàng {row}, cột {col}: {piece}" (1-based, Vietnamese is the default locale).
const cell = (page: Page, row: number, col: number) =>
  page.getByRole('gridcell', { name: new RegExp(`^Hàng ${row}, cột ${col}:`) });
const status = (page: Page) => page.getByRole('status').first();

test('choose Caro from the home page and play against the computer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Caro/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Caro' })).toBeVisible();
  await page.getByRole('radio', { name: 'Dễ' }).check();
  await page.getByRole('button', { name: 'Bắt đầu' }).click();

  await expect(page).toHaveURL(/\/play\/caro\?.*level=easy/);
  await expect(page.getByRole('grid', { name: 'Bàn cờ Caro 15 × 15' })).toBeVisible();
  await expect(status(page)).toHaveText('Lượt của X · Bạn');

  await cell(page, 8, 8).click();
  await expect(cell(page, 8, 8)).toHaveAttribute('data-piece', 'x');
  // The bot (in a Web Worker) answers with an O.
  await expect(page.locator('[data-piece="o"]')).toHaveCount(1, { timeout: 10_000 });
  await expect(status(page)).toHaveText('Lượt của X · Bạn');

  // Undo removes both my move and the bot reply.
  await page.getByRole('button', { name: /Đi lại/ }).click();
  await expect(page.locator('[data-piece]')).toHaveCount(0);
});

test('two players on one device play to a win', async ({ page }) => {
  await page.goto('/play/caro?mode=local');
  await expect(status(page)).toHaveText('Lượt của X · Người chơi 1');

  const xs = [4, 5, 6, 7, 8];
  const os = [1, 3, 5, 7];
  for (let i = 0; i < xs.length; i++) {
    await cell(page, 8, xs[i]!).click();
    if (os[i] !== undefined) await cell(page, 1, os[i]!).click();
  }

  await expect(status(page)).toHaveText('X · Người chơi 1 thắng (5 quân liên tiếp)');
  await expect(page.locator('[data-win="true"]')).toHaveCount(5);
  // The board no longer accepts moves.
  await cell(page, 10, 10).click();
  await expect(cell(page, 10, 10)).not.toHaveAttribute('data-piece', /.*/);

  await page.getByRole('button', { name: 'Ván mới' }).click();
  await expect(page.locator('[data-piece]')).toHaveCount(0);
});

test('the board works with the keyboard', async ({ page }) => {
  await page.goto('/play/caro?mode=local');
  await cell(page, 8, 8).focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(cell(page, 7, 7)).toHaveAttribute('data-piece', 'x');
});

test('the language switcher changes the UI to English', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Ngôn ngữ' }).selectOption('en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pick a game');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('vi');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chọn một game');
});
