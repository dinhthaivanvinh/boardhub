import { expect, test, type Browser, type Page } from '@playwright/test';

// Displayed coordinates: column 1..5 left to right, row 1..5 from the bottom (your own side).
const point = (page: Page, col: number, row: number) =>
  page.getByRole('gridcell', { name: new RegExp(`^Cột ${col}, hàng ${row}:`) });
const status = (page: Page) => page.getByRole('status').first();

async function newPlayer(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

test('the home page lists Cờ gánh', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Cờ gánh/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cờ gánh' })).toBeVisible();
});

test('two players on one device: select a piece, step along a line', async ({ page }) => {
  await page.goto('/play/co-ganh?mode=local');
  await expect(page.locator('[data-piece="0"]')).toHaveCount(8);
  await expect(page.locator('[data-piece="1"]')).toHaveCount(8);
  await point(page, 3, 1).click();
  await expect(point(page, 3, 1)).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('[data-target="true"]')).toHaveCount(3);
  await point(page, 3, 2).click();
  await expect(point(page, 3, 2)).toHaveAttribute('data-piece', '0');
  await expect(status(page)).toHaveText('Lượt của Xanh · Người chơi 2');
});

test('the computer answers', async ({ page }) => {
  await page.goto('/play/co-ganh?mode=bot&level=easy');
  await point(page, 3, 1).click();
  await point(page, 3, 2).click();
  await expect(status(page)).toHaveText('Lượt của Đỏ · Bạn', { timeout: 10_000 });
  await expect(page.locator('[data-last="true"]')).toHaveCount(2);
});

test('private room: the second player sees the board turned round and the first move', async ({
  browser,
}) => {
  const red = await newPlayer(browser);
  const blue = await newPlayer(browser);
  await red.goto('/games/co-ganh');
  await red.getByRole('radio', { name: 'Chơi online với bạn bè' }).check();
  await red.getByRole('button', { name: 'Tạo phòng' }).click();
  await expect(red).toHaveURL(/\/room\/[A-Z0-9]{6}$/);

  await blue.goto(red.url());
  await blue.getByTestId('seat-1').getByRole('button', { name: 'Ngồi vào đây' }).click();
  await blue.getByRole('button', { name: 'Tôi sẵn sàng' }).click();
  await expect(red.getByTestId('seat-1')).toContainText('Sẵn sàng');
  await red.getByRole('button', { name: 'Bắt đầu ván' }).click();

  // Each player has their own pieces at the bottom.
  await expect(point(red, 1, 1)).toHaveAttribute('data-piece', '0');
  await expect(point(blue, 1, 1)).toHaveAttribute('data-piece', '1');

  await point(red, 3, 1).click();
  await point(red, 3, 2).click();
  // Seen from Blue, Red's (row 2, col 3) is at col 3, row 4.
  await expect(point(blue, 3, 4)).toHaveAttribute('data-piece', '0');
  await expect(status(blue)).toContainText('Lượt của Xanh');
  await expect(status(blue)).toContainText('(bạn)');
});
