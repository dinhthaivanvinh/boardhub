import { expect, test, type Page } from '@playwright/test';

// The app records each sound it plays when this flag is set (apps/web/src/sound/play.ts).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bg-sound-debug', '1'));
});

const cell = (page: Page, row: number, col: number) =>
  page.getByRole('gridcell', { name: new RegExp(`^Hàng ${row}, cột ${col}:`) });
const played = (page: Page) => page.evaluate(() => window.__bgSounds ?? []);

test('moves and the win have their sounds; effects can be switched off and stay off', async ({ page }) => {
  await page.goto('/play/caro?mode=local');
  await expect(page.getByRole('group', { name: 'Âm thanh' })).toBeVisible();

  const xs = [4, 5, 6, 7, 8];
  const os = [1, 3, 5, 7];
  for (let i = 0; i < xs.length; i++) {
    await cell(page, 8, xs[i]!).click();
    if (os[i] !== undefined) await cell(page, 1, os[i]!).click();
  }
  await expect.poll(() => played(page)).toEqual([...Array(9).fill('place'), 'win']);

  await page.getByRole('button', { name: 'Ván mới' }).click();
  await page.getByTestId('sound-effects').uncheck();
  await cell(page, 8, 8).click();
  await expect(cell(page, 8, 8)).toHaveAttribute('data-piece', 'x');
  expect(await played(page)).toHaveLength(10);

  await page.reload();
  await expect(page.getByTestId('sound-effects')).not.toBeChecked();
  await expect(page.getByTestId('sound-music')).toBeChecked();
});

test('chess against the computer: losing plays the gentle "lose" jingle', async ({ page }) => {
  await page.goto('/play/chess?mode=bot&level=easy');
  await page.getByRole('button', { name: /Đầu hàng/ }).click();
  await expect.poll(() => played(page)).toContain('lose');
});
