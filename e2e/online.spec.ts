import { expect, test, type Browser, type Page } from '@playwright/test';

// Two separate browser contexts = two different guests, like two people on two machines.
async function newPlayer(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

const caroCell = (page: Page, row: number, col: number) =>
  page.getByRole('gridcell', { name: new RegExp(`^Hàng ${row}, cột ${col}:`) });
const status = (page: Page) => page.getByRole('status').first();

test('two guests play Caro online through an invite link', async ({ browser }) => {
  const alice = await newPlayer(browser);
  const bob = await newPlayer(browser);

  // Alice creates a room from the game page.
  await alice.goto('/games/caro');
  await alice.getByRole('radio', { name: 'Chơi online với bạn bè' }).check();
  await alice.getByRole('button', { name: 'Tạo phòng' }).click();
  await expect(alice).toHaveURL(/\/room\/[A-Z0-9]{6}$/);
  const code = (await alice.getByTestId('room-code').textContent())!.trim();

  // Bob opens the invite link, sits down and gets ready.
  await bob.goto(`/room/${code}`);
  await bob.getByTestId('seat-1').getByRole('button', { name: 'Ngồi vào đây' }).click();
  await bob.getByRole('button', { name: 'Tôi sẵn sàng' }).click();

  // Alice sees Bob ready and starts.
  await expect(alice.getByTestId('seat-1')).toContainText('Sẵn sàng');
  await alice.getByRole('button', { name: 'Bắt đầu ván' }).click();
  await expect(alice.getByRole('grid')).toBeVisible();
  await expect(bob.getByRole('grid')).toBeVisible();

  // X (Alice) builds row 8, O (Bob) plays on row 1. Each side waits to see the other's move.
  const xs = [4, 5, 6, 7, 8];
  const os = [1, 3, 5, 7];
  for (let i = 0; i < xs.length; i++) {
    await caroCell(alice, 8, xs[i]!).click();
    await expect(caroCell(bob, 8, xs[i]!)).toHaveAttribute('data-piece', 'x');
    if (os[i] === undefined) break;
    await caroCell(bob, 1, os[i]!).click();
    await expect(caroCell(alice, 1, os[i]!)).toHaveAttribute('data-piece', 'o');
  }

  await expect(status(alice)).toContainText('thắng (5 quân liên tiếp)');
  await expect(status(bob)).toContainText('thắng (5 quân liên tiếp)');
  await expect(alice.locator('[data-win="true"]')).toHaveCount(5);

  // Chat reaches the other player.
  await bob.getByLabel('Nhập tin nhắn…').fill('ván hay!');
  await bob.getByRole('button', { name: 'Gửi' }).click();
  await expect(alice.getByText('ván hay!')).toBeVisible();

  // Bob reloads: same guest, same seat, the finished board is still there.
  await bob.reload();
  await expect(bob.locator('[data-win="true"]')).toHaveCount(5);
  await expect(bob.getByRole('button', { name: 'Chơi lại' })).toBeVisible();
});

test('play Four in a Row online against a computer added by the host', async ({ browser }) => {
  const page = await newPlayer(browser);
  await page.goto('/games/four-in-a-row');
  await page.getByRole('radio', { name: 'Chơi online với bạn bè' }).check();
  await page.getByRole('button', { name: 'Tạo phòng' }).click();
  await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}$/);

  await page.getByTestId('seat-1').getByRole('button', { name: 'Thêm máy' }).click();
  await page.getByRole('button', { name: 'Bắt đầu ván' }).click();
  await page.getByRole('gridcell', { name: /^Cột 4, hàng 6:/ }).click();
  await expect(page.locator('[data-piece="p1"]')).toHaveCount(1, { timeout: 10_000 });
});

test('an unknown room code shows a friendly message', async ({ page }) => {
  await page.goto('/room/ZZZZZZ');
  await expect(page.getByText('Không tìm thấy phòng ZZZZZZ')).toBeVisible();
});

test('the home page join box opens a room by code', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/Có mã phòng/).fill('ab12cd');
  await page.getByRole('button', { name: 'Vào phòng' }).click();
  await expect(page).toHaveURL(/\/room\/AB12CD$/);
});
