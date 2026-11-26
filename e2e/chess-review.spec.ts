import { expect, test, type Page } from '@playwright/test';

/** Going over a finished chess game: offered after a game against the computer and on its replay. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('learn.chess.voice.v1', JSON.stringify({ auto: false, results: false }));
  });
});

const square = (page: Page, name: string) => page.locator(`[data-square="${name}"]`);

/** Waits for the player's turn (the hint button is enabled then). */
const myTurn = (page: Page) => expect(page.getByTestId('coach-hint')).toBeEnabled({ timeout: 15_000 });

async function playThenResign(page: Page, moves: [string, string][]) {
  await page.goto('/play/chess?mode=bot&level=easy');
  for (const [from, to] of moves) {
    await myTurn(page);
    await square(page, from).click();
    await square(page, to).click();
    await expect(square(page, from)).not.toHaveAttribute('data-piece', /^w/);
  }
  await myTurn(page);
  await page.getByRole('button', { name: /Đầu hàng/ }).click();
}

test('after a game the review opens, and can be closed back to the replay', async ({ page }) => {
  await playThenResign(page, [
    ['e2', 'e4'],
    ['a2', 'a3'],
  ]);
  const open = page.getByTestId('match-review');
  await expect(open).toBeVisible();
  await open.click();
  await expect(page).toHaveURL(/\/replay\/local\/.+\?review=1$/);
  await expect(page.getByRole('heading', { name: 'Xem lại ván' })).toBeVisible();
  // It ends either with a moment to look at or with nothing to point out; both show a board.
  await expect(page.getByTestId('review-progress')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole('grid')).toBeVisible();
  const wider = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wider).toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: /Đóng/ }).click();
  await expect(page.getByTestId('replay-position')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('replay-review').click();
  await expect(page.getByRole('heading', { name: 'Xem lại ván' })).toBeVisible();
});

test('two people at one screen are not offered a review', async ({ page }) => {
  await page.goto('/play/chess?mode=local');
  await square(page, 'e2').click();
  await square(page, 'e4').click();
  await page.getByRole('button', { name: /Đầu hàng/ }).click();
  await expect(page.getByTestId('local-replay')).toBeVisible();
  await expect(page.getByTestId('match-review')).toHaveCount(0);
  await page.getByTestId('local-replay').click();
  // Half a second on its own; many seconds when all the browsers of a parallel run share the machine.
  await expect(page.getByTestId('replay-position')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('replay-review')).toHaveCount(0);
});
