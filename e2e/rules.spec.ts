import { expect, test, type Page } from '@playwright/test';

const rulesDialog = (page: Page) => page.getByRole('dialog');
const caroCell = (page: Page, row: number, col: number) =>
  page.getByRole('gridcell', { name: new RegExp(`^Hàng ${row}, cột ${col}:`) });

test('rules can be read during a game without losing it', async ({ page }) => {
  const config = encodeURIComponent(JSON.stringify({ size: 19, blockedEndsRule: false }));
  await page.goto(`/play/caro?mode=local&config=${config}`);
  await caroCell(page, 10, 10).click();
  await expect(caroCell(page, 10, 10)).toHaveAttribute('data-piece', 'x');

  await page.getByRole('button', { name: /Luật chơi/ }).click();
  const dialog = rulesDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Luật chơi: Caro' })).toBeVisible();
  // The options of THIS game come first…
  await expect(dialog.getByRole('region', { name: 'Tùy chọn của ván này' })).toContainText('19 × 19');
  await expect(dialog.getByRole('region', { name: 'Tùy chọn của ván này' })).toContainText(
    'Chặn hai đầu không tính thắngTắt',
  );
  // …then the full rules.
  await expect(dialog).toContainText('5 quân liên tiếp');

  // Esc closes it; the game is untouched and still playable.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(caroCell(page, 10, 10)).toHaveAttribute('data-piece', 'x');
  await caroCell(page, 10, 11).click();
  await expect(caroCell(page, 10, 11)).toHaveAttribute('data-piece', 'o');

  // The close button works too.
  await page.getByRole('button', { name: /Luật chơi/ }).click();
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  await expect(dialog).toBeHidden();
});

test('a game without options shows only the rules', async ({ page }) => {
  await page.goto('/play/xiangqi?mode=local');
  await page.getByRole('button', { name: /Luật chơi/ }).click();
  await expect(rulesDialog(page)).toContainText('Hai Tướng không được đối mặt');
  await expect(rulesDialog(page).getByRole('region', { name: 'Tùy chọn của ván này' })).toHaveCount(0);
});

test('online rooms also show the time control and disconnect rule', async ({ page }) => {
  await page.goto('/games/four-in-a-row');
  await page.getByRole('radio', { name: 'Chơi online với bạn bè' }).check();
  await page.getByLabel('Thời gian').selectOption('blitz');
  await page.getByRole('button', { name: 'Tạo phòng' }).click();
  await expect(page).toHaveURL(/\/room\//);
  await page.getByRole('button', { name: /Luật chơi/ }).click();
  const options = rulesDialog(page).getByRole('region', { name: 'Tùy chọn của ván này' });
  await expect(options).toContainText('3 phút + 2 giây/nước');
  await expect(options).toContainText('Xử thua');
  await expect(options).toContainText('Số cột7');
});
