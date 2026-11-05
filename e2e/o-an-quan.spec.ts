import { expect, test, type Browser, type Page } from '@playwright/test';

const status = (page: Page) => page.getByRole('status').first();
/** Square n (1..5, left to right) of your own row. */
const mine = (page: Page, n: number) => page.getByRole('button', { name: new RegExp(`^Ô ${n} của bạn:`) });
const square = (page: Page, cell: number) => page.locator(`[data-cell="${cell}"]`);

async function newPlayer(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

// Moves are played out stone by stone; most tests skip that through the reduced-motion setting.
test.use({ reducedMotion: 'reduce' });

test.describe('with the sowing animation', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('your move and the computer reply are both played out stone by stone', async ({ page }) => {
    await page.goto('/play/o-an-quan?mode=bot&level=easy');
    await mine(page, 1).click();
    await page.getByRole('button', { name: /Rải sang phải/ }).click();
    const hand = page.getByTestId('sowing-hand');
    await expect(hand).toContainText('5');
    await expect(hand).toContainText('4');
    // Square 2 receives its stone before it is captured at the end.
    await expect(square(page, 2)).toHaveAttribute('data-count', '6');
    await expect(square(page, 2)).toHaveAttribute('data-taken', 'true', { timeout: 15_000 });
    // Then the computer's move plays out too, and only then is it your turn again.
    await expect(hand).toBeVisible({ timeout: 15_000 });
    await expect(status(page)).toHaveText('Lượt của Bên 1 · Bạn');
    await expect(hand).toBeHidden({ timeout: 20_000 });
  });

  test('"Xem nhanh" skips to the result', async ({ page }) => {
    await page.goto('/play/o-an-quan?mode=local');
    await mine(page, 1).click();
    await page.getByRole('button', { name: /Rải sang phải/ }).click();
    await expect(page.getByTestId('sowing-hand')).toBeVisible();
    await page.getByRole('button', { name: /Xem nhanh/ }).click();
    await expect(page.getByTestId('sowing-hand')).toBeHidden();
    await expect(square(page, 2)).toHaveAttribute('data-taken', 'true');
  });
});

test('the home page lists Ô ăn quan', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Ô ăn quan/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ô ăn quan' })).toBeVisible();
});

test('two players on one device: pick a square, sow to the right, capture', async ({ page }) => {
  await page.goto('/play/o-an-quan?mode=local');
  await expect(page.locator('[data-quan="true"]')).toHaveCount(2);
  await mine(page, 1).click();
  await page.getByRole('button', { name: /Rải sang phải/ }).click();
  // Square 1 runs round the board and lands before the emptied square 1: square 2 (6 dân) is captured.
  await expect(square(page, 2)).toHaveAttribute('data-taken', 'true');
  await expect(page.getByTestId('stash-bottom')).toContainText('6 dân · 0 quan');
  await expect(status(page)).toHaveText('Lượt của Bên 2 · Người chơi 2');

  // Side 2 plays from the top row on the same screen.
  await mine(page, 2).click();
  await page.getByRole('button', { name: /Rải sang trái/ }).click();
  await expect(status(page)).toHaveText('Lượt của Bên 1 · Người chơi 1');
});

test('the computer answers', async ({ page }) => {
  await page.goto('/play/o-an-quan?mode=bot&level=easy');
  await mine(page, 3).click();
  await page.getByRole('button', { name: /Rải sang trái/ }).click();
  await expect(status(page)).toHaveText('Lượt của Bên 1 · Bạn', { timeout: 10_000 });
  await expect(page.locator('[data-start="true"]')).toHaveCount(1);
});

test('private room: side 2 sees its own row at the bottom and the first move', async ({ browser }) => {
  const one = await newPlayer(browser);
  const two = await newPlayer(browser);
  await one.goto('/games/o-an-quan');
  await one.getByRole('radio', { name: 'Chơi online với bạn bè' }).check();
  await one.getByRole('button', { name: 'Tạo phòng' }).click();
  await expect(one).toHaveURL(/\/room\/[A-Z0-9]{6}$/);

  await two.goto(one.url());
  await two.getByTestId('seat-1').getByRole('button', { name: 'Ngồi vào đây' }).click();
  await two.getByRole('button', { name: 'Tôi sẵn sàng' }).click();
  await expect(one.getByTestId('seat-1')).toContainText('Sẵn sàng');
  await one.getByRole('button', { name: 'Bắt đầu ván' }).click();

  await expect(mine(one, 1)).toHaveAttribute('data-cell', '1');
  await expect(mine(two, 1)).toHaveAttribute('data-cell', '7');

  await mine(one, 1).click();
  await one.getByRole('button', { name: /Rải sang phải/ }).click();
  await expect(square(two, 2)).toHaveAttribute('data-taken', 'true');
  await expect(status(two)).toContainText('(bạn)');
});
