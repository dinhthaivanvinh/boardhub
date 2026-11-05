import { expect, test, type Browser, type Page } from '@playwright/test';

const status = (page: Page) => page.getByRole('status').first();
const sea = (page: Page, id: 'sea-enemy' | 'sea-mine' | 'sea-placement') => page.getByTestId(id);
/** A square by its name, e.g. "E5", in one sea. */
const square = (page: Page, id: 'sea-enemy' | 'sea-mine', name: string) =>
  sea(page, id).getByRole('gridcell', { name: new RegExp(`^${name}:`) });

async function placeRandomly(page: Page) {
  await page.getByRole('button', { name: /Xếp ngẫu nhiên/ }).click();
  await expect(sea(page, 'sea-placement').locator('[data-state="ship"]')).toHaveCount(17);
  await page.getByRole('button', { name: 'Xong, vào trận!' }).click();
}

async function newPlayer(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

test('the home page lists Bắn tàu', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Bắn tàu/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Bắn tàu' })).toBeVisible();
});

test('against the computer: place the fleet, fire, and the computer fires back', async ({ page }) => {
  await page.goto('/play/ban-tau?mode=bot&level=easy');
  await placeRandomly(page);
  // The computer places its ships, then it is our turn to fire.
  await expect(page.getByText('Chọn một ô trên biển đối thủ để bắn.', { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(sea(page, 'sea-enemy').locator('[data-state="ship"]')).toHaveCount(0);
  await expect(sea(page, 'sea-mine').locator('[data-state="ship"]')).toHaveCount(17);

  // Fire down column A until a miss hands the turn over; the computer then fires into our sea.
  for (let row = 1; row <= 10; row++) {
    await square(page, 'sea-enemy', `A${row}`).click();
    await expect(square(page, 'sea-enemy', `A${row}`)).toHaveAttribute('data-state', /miss|hit|sunk/);
    if ((await square(page, 'sea-enemy', `A${row}`).getAttribute('data-state')) === 'miss') break;
  }
  await expect(
    sea(page, 'sea-mine').locator('[data-state="miss"], [data-state="hit"], [data-state="sunk"]').first(),
  ).toBeVisible({
    timeout: 10_000,
  });
});

test('two players on one device: each fleet is hidden behind a hand-over screen', async ({ page }) => {
  await page.goto('/play/ban-tau?mode=local');
  await placeRandomly(page);
  await expect(page.getByText('Đưa máy cho Hạm đội Cam')).toBeVisible();
  await expect(sea(page, 'sea-placement')).toHaveCount(0);
  await page.getByRole('button', { name: /Tôi là Hạm đội Cam/ }).click();
  await placeRandomly(page);
  await expect(page.getByText('Đưa máy cho Hạm đội Xanh')).toBeVisible();
  await page.getByRole('button', { name: /Tôi là Hạm đội Xanh/ }).click();
  await expect(status(page)).toHaveText('Lượt của Hạm đội Xanh · Người chơi 1');
  await square(page, 'sea-enemy', 'E5').click();
  // A hit keeps the turn (E5 is marked); a miss hands the device over (the board is covered again).
  await expect(
    page
      .getByText('Đưa máy cho Hạm đội Cam')
      .or(sea(page, 'sea-enemy').locator('[data-state="hit"], [data-state="sunk"]'))
      .first(),
  ).toBeVisible();
});

test('online: the opponent never sees your ships, but sees your shots land', async ({ browser }) => {
  const blue = await newPlayer(browser);
  const orange = await newPlayer(browser);
  await blue.goto('/games/ban-tau');
  await blue.getByRole('radio', { name: 'Chơi online với bạn bè' }).check();
  await blue.getByRole('button', { name: 'Tạo phòng' }).click();
  await expect(blue).toHaveURL(/\/room\/[A-Z0-9]{6}$/);
  await orange.goto(blue.url());
  await orange.getByTestId('seat-1').getByRole('button', { name: 'Ngồi vào đây' }).click();
  await orange.getByRole('button', { name: 'Tôi sẵn sàng' }).click();
  await expect(blue.getByTestId('seat-1')).toContainText('Sẵn sàng');
  await blue.getByRole('button', { name: 'Bắt đầu ván' }).click();

  await placeRandomly(blue);
  await placeRandomly(orange);
  await expect(blue.getByText('Chọn một ô trên biển đối thủ để bắn.', { exact: true })).toBeVisible();

  // Neither side can see the other's ships.
  await expect(sea(blue, 'sea-enemy').locator('[data-state="ship"]')).toHaveCount(0);
  await expect(sea(orange, 'sea-enemy').locator('[data-state="ship"]')).toHaveCount(0);

  await square(blue, 'sea-enemy', 'D4').click();
  await expect(square(orange, 'sea-mine', 'D4')).toHaveAttribute('data-state', /miss|hit|sunk/);
});
