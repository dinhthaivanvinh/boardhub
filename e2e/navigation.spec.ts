import { expect, test } from '@playwright/test';

test('on a phone the menu opens Live games and the Leaderboard', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the menu button is only shown on small screens');
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Menu' });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');

  await menu.click();
  await page.locator('#mobile-nav').getByRole('link', { name: 'Xếp hạng' }).click();
  await expect(page).toHaveURL(/\/leaderboard/);
  await expect(page.locator('#mobile-nav')).toBeHidden();

  await menu.click();
  await page.locator('#mobile-nav').getByRole('link', { name: 'Đang diễn ra' }).click();
  await expect(page).toHaveURL(/\/live/);

  await menu.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-nav')).toBeHidden();
});

test('on a desktop the links are in the header', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
  await page.getByRole('navigation', { name: 'Điều hướng' }).getByRole('link', { name: 'Xếp hạng' }).click();
  await expect(page).toHaveURL(/\/leaderboard/);
});
