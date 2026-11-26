import { expect, test, type Page } from '@playwright/test';

/** Help against the computer in chess: a suggested move, and a warning about pieces in danger. */

const square = (page: Page, name: string) => page.locator(`[data-square="${name}"]`);

test('a hint points at a move that can be played, and goes away once played', async ({ page }) => {
  await page.goto('/play/chess?mode=bot&level=easy');
  const hint = page.getByTestId('coach-hint');
  await expect(hint).toBeEnabled();
  await hint.click();
  await expect(page.getByTestId('coach-message')).toContainText(/từ [a-h][1-8] đến [a-h][1-8]/);
  const marked = page.locator('[data-hint="true"]');
  await expect(marked).toHaveCount(2);

  const [from, to] = (await page.getByTestId('coach-message').textContent())!.match(/[a-h][1-8]/g)!;
  await square(page, from!).click();
  await square(page, to!).click();
  await expect(square(page, to!)).toHaveAttribute('data-piece', /^w/);
  await expect(marked).toHaveCount(0);
});

test('there is no help between two people, nor in a game without a coach', async ({ page }) => {
  await page.goto('/play/chess?mode=local');
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.getByTestId('coach-hint')).toHaveCount(0);
  await page.goto('/play/caro?mode=bot&level=easy');
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.getByTestId('coach-hint')).toHaveCount(0);
});

test('the warning can be turned off, and stays off', async ({ page }) => {
  await page.goto('/play/chess?mode=bot&level=easy');
  await page.getByText('Cài đặt', { exact: false }).first().click();
  const box = page.getByRole('checkbox', { name: 'Cảnh báo quân đang bị đe doạ' });
  await expect(box).toBeChecked();
  await box.uncheck();
  await page.reload();
  await page.getByText('Cài đặt', { exact: false }).first().click();
  await expect(box).not.toBeChecked();
});
