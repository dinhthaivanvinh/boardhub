import { expect, test, type Browser, type Page } from '@playwright/test';

async function newPlayer(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

async function findMatch(page: Page, game: string) {
  await page.goto(`/games/${game}`);
  await page.getByRole('radio', { name: 'Ghép trận nhanh với người lạ' }).check();
  await expect(page.getByLabel('Tính điểm xếp hạng')).toBeChecked();
  await page.getByRole('button', { name: 'Tìm đối thủ' }).click();
  await expect(page).toHaveURL(/\/queue\?/);
}

const column = (page: Page, col: number) =>
  page.getByRole('gridcell', { name: new RegExp(`^Cột ${col}, hàng 6:`) });

test('quick match: two strangers are paired, play a rated game, and others can watch', async ({
  browser,
}) => {
  // Only one pair at a time may queue for this bucket, or the two projects would cross-match.
  test.skip(test.info().project.name !== 'desktop', 'shares one matchmaking bucket; run once');

  const a = await newPlayer(browser);
  const b = await newPlayer(browser);
  await findMatch(a, 'four-in-a-row');
  await expect(a.getByRole('status')).toContainText('Đã chờ');
  await findMatch(b, 'four-in-a-row');

  await expect(a).toHaveURL(/\/room\/[A-Z0-9]{6}$/, { timeout: 10_000 });
  await expect(b).toHaveURL(/\/room\/[A-Z0-9]{6}$/, { timeout: 10_000 });
  expect(new URL(a.url()).pathname).toBe(new URL(b.url()).pathname);
  await expect(a.getByText('Tính điểm', { exact: true })).toBeVisible();

  // A third person finds the game on the live page and watches it.
  const watcher = await newPlayer(browser);
  await watcher.goto('/live');
  await watcher.getByTestId('live-row').first().click();
  await expect(watcher.getByText('Bạn đang xem trận này.')).toBeVisible();

  // Whoever was given Yellow (seat 0) moves first.
  const aFirst = (await a.getByRole('status').first().textContent())?.includes('(bạn)');
  const [first, second] = aFirst ? [a, b] : [b, a];
  for (let i = 0; i < 4; i++) {
    await column(first, 1).click();
    await expect(second.locator('[data-piece="p0"]')).toHaveCount(i + 1);
    if (i === 3) break;
    await column(second, 2).click();
    await expect(first.locator('[data-piece="p1"]')).toHaveCount(i + 1);
  }

  // Both see the result and the rating changes; so does the spectator.
  for (const page of [first, second, watcher]) {
    await expect(page.getByRole('status').first()).toContainText('thắng (4 quân liên tiếp)');
  }
  await expect(first.getByTestId('rating-change')).toHaveCount(2);
  await expect(first.getByTestId('rating-change').first()).toContainText('(+');

  // The winner's profile shows a provisional rating; the leaderboard needs more games.
  await first.goto('/profile');
  await expect(first.getByTestId('rating-row')).toContainText('Bốn trong hàng');
  await expect(first.getByTestId('rating-row')).toContainText('?');
  await first.goto('/leaderboard?game=four-in-a-row');
  await expect(first.getByText('Chưa có ai đủ 5 ván tính điểm')).toBeVisible();
});

test('cancelling the search leaves the queue', async ({ browser }) => {
  test.skip(test.info().project.name !== 'desktop', 'shares one matchmaking bucket; run once');
  const a = await newPlayer(browser);
  await a.goto('/games/reversi');
  await a.getByRole('radio', { name: 'Ghép trận nhanh với người lạ' }).check();
  await a.getByLabel('Tính điểm xếp hạng').uncheck();
  await a.getByRole('button', { name: 'Tìm đối thủ' }).click();
  await expect(a.getByRole('status')).toContainText('Đã chờ');
  await a.getByRole('link', { name: 'Hủy tìm' }).click();
  await expect(a).toHaveURL(/\/games\/reversi$/);

  // Someone else searching now is not paired with the player who left.
  const b = await newPlayer(browser);
  await b.goto('/queue?game=reversi&tc=blitz&ranked=0');
  await b.waitForTimeout(2_500);
  await expect(b).toHaveURL(/\/queue\?/);
});
