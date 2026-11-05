import { expect, test, type Page } from '@playwright/test';

const cell = (page: Page, row: number, col: number) =>
  page.getByRole('gridcell', { name: new RegExp(`^Hàng ${row}, cột ${col}:`) });

test('a game against the computer is saved in the browser and can be replayed', async ({ page }) => {
  await page.goto('/play/caro?mode=bot&level=easy');
  await cell(page, 8, 8).click();
  await expect(page.locator('[data-piece="o"]')).toHaveCount(1, { timeout: 10_000 });
  await page.getByRole('button', { name: /Đầu hàng/ }).click();
  await expect(page.getByTestId('result-overlay')).toHaveAttribute('data-tone', 'loss');
  await page.keyboard.press('Escape');

  await page.getByTestId('local-replay').click();
  await expect(page).toHaveURL(/\/replay\/local\/[0-9a-f]{32}$/);
  await expect(page.getByTestId('replay-position')).toHaveText('Nước 2 / 2');
  await expect(page.locator('[data-piece]')).toHaveCount(2);
  await page.keyboard.press('Home');
  await expect(page.locator('[data-piece]')).toHaveCount(0);
  await expect(page.getByText('Máy (Dễ)')).toBeVisible();

  // Listed in the profile, from the player's side, and still there after a reload.
  await page.goto('/profile');
  const row = page.getByTestId('local-history-row').first();
  await expect(row).toContainText('Caro');
  await expect(row).toContainText('Thua');
  await page.reload();
  await expect(page.getByTestId('local-history-row')).toHaveCount(1);
  await row.click();
  await expect(page).toHaveURL(/\/replay\/local\//);
});

test('a two-player game at one screen is saved too; a missing game is explained', async ({ page }) => {
  await page.goto('/play/caro?mode=local');
  const xs = [4, 5, 6, 7, 8];
  const os = [1, 3, 5, 7];
  for (let i = 0; i < xs.length; i++) {
    await cell(page, 8, xs[i]!).click();
    if (os[i] !== undefined) await cell(page, 1, os[i]!).click();
  }
  await expect(page.getByTestId('local-replay')).toBeVisible();
  await page.goto('/profile');
  await expect(page.getByTestId('local-history-row').first()).toContainText('Người chơi 1 thắng');

  await page.goto(`/replay/local/${'0'.repeat(32)}`);
  await expect(page.getByRole('alert').filter({ hasText: 'Không tìm thấy ván này' })).toBeVisible();
});
