import { expect, test } from '@playwright/test';

test('the journey sends a child to a game against the gentle computer, which answers a move', async ({
  page,
}) => {
  await page.goto('/journey');
  await page.getByTestId('journey-play-easy').click();
  await expect(page).toHaveURL(/mode=bot/);
  await expect(page).toHaveURL(/level=easy/);
  const sq = (name: string) => page.locator(`[data-square="${name}"]`);
  await expect(sq('e1')).toHaveAttribute('data-piece', 'wK');
  await sq('e2').click();
  await sq('e4').click();
  await expect(sq('e4')).toHaveAttribute('data-piece', 'wP');
  // The computer answers: it is the child's turn again and two squares show the last move.
  await expect(page.getByRole('status').first()).toHaveText(/Lượt của Trắng · Bạn/, { timeout: 15_000 });
  await expect(page.locator('[data-last="true"]')).toHaveCount(2);
});
