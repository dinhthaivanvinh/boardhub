import { expect, test, type Browser, type Page } from '@playwright/test';

const status = (page: Page) => page.getByRole('status').first();
const sq = (page: Page, name: string) => page.locator(`[data-square="${name}"]`);

async function move(page: Page, from: string, to: string) {
  await sq(page, from).click();
  await sq(page, to).click();
}

async function newPlayer(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

test('the home page lists Cờ vua', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Cờ vua/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cờ vua' })).toBeVisible();
});

test("two players on one device: scholar's mate ends the game", async ({ page }) => {
  await page.goto('/play/chess?mode=local');
  await expect(sq(page, 'e1')).toHaveAttribute('data-piece', 'wK');
  await sq(page, 'g1').click();
  await expect(page.locator('[data-target="true"]')).toHaveCount(2);
  await sq(page, 'g1').click(); // deselect
  for (const [from, to] of [
    ['e2', 'e4'],
    ['e7', 'e5'],
    ['f1', 'c4'],
    ['b8', 'c6'],
    ['d1', 'h5'],
    ['g8', 'f6'],
    ['h5', 'f7'],
  ] as const) {
    await move(page, from, to);
    await expect(sq(page, to)).toHaveAttribute('data-piece', /^[wb]/);
  }
  await expect(status(page)).toContainText('thắng (chiếu bí)');
  await expect(sq(page, 'e8')).toHaveAttribute('data-check', 'true');
});

test('against the computer, playing Black: the board is turned and the computer opens', async ({ page }) => {
  await page.goto('/play/chess?mode=bot&level=easy&side=1');
  await expect(page.getByRole('gridcell').nth(56)).toHaveAttribute('data-square', 'h8');
  await expect(status(page)).toHaveText('Lượt của Đen · Bạn', { timeout: 15_000 });
  await expect(page.locator('[data-last="true"]')).toHaveCount(2);
});

test('online: a move reaches the opponent, who sees the board from Black', async ({ browser }) => {
  const white = await newPlayer(browser);
  const black = await newPlayer(browser);
  await white.goto('/games/chess');
  await white.getByRole('radio', { name: 'Chơi online với bạn bè' }).check();
  await white.getByRole('button', { name: 'Tạo phòng' }).click();
  await expect(white).toHaveURL(/\/room\/[A-Z0-9]{6}$/);
  await black.goto(white.url());
  await black.getByTestId('seat-1').getByRole('button', { name: 'Ngồi vào đây' }).click();
  await black.getByRole('button', { name: 'Tôi sẵn sàng' }).click();
  await expect(white.getByTestId('seat-1')).toContainText('Sẵn sàng');
  await white.getByRole('button', { name: 'Bắt đầu ván' }).click();

  await expect(black.getByRole('gridcell').nth(56)).toHaveAttribute('data-square', 'h8');
  await move(white, 'e2', 'e4');
  await expect(sq(black, 'e4')).toHaveAttribute('data-piece', 'wP');
  await move(black, 'c7', 'c5');
  await expect(sq(white, 'c5')).toHaveAttribute('data-piece', 'bP');
});
