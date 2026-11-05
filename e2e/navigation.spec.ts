import { expect, test } from '@playwright/test';

test('the portal leads to both areas', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chơi cùng nhau, ngay trên trình duyệt');
  await page.getByTestId('area-board-games').click();
  await expect(page).toHaveURL(/\/board-games$/);
  await expect(page.getByRole('link', { name: /Cờ vua/ })).toBeVisible();

  await page.goto('/');
  await page.getByTestId('area-office').click();
  await expect(page).toHaveURL(/\/office$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Văn phòng' })).toBeVisible();
  await expect(page.getByTestId('activity-lucky-animal')).toContainText('Thú may mắn');
  await expect(page.getByTestId('activity-lucky-animal')).toContainText('Tạo phiên');
  await expect(page.getByTestId('activity-team-split')).toContainText('Sắp ra mắt');
  await page
    .getByRole('link', { name: /Thú của tôi/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/office\/avatar$/);
});

test('a missing room points back to the board games', async ({ page }) => {
  await page.goto('/room/ZZZZZZ');
  await expect(page.getByRole('link', { name: 'Về danh mục game' })).toHaveAttribute('href', '/board-games');
});

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop layout');

  test('header menus: Board game ▾ and Văn phòng ▾', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Điều hướng' });
    await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();

    const boardGames = nav.getByRole('button', { name: 'Board game' });
    await expect(boardGames).toHaveAttribute('aria-expanded', 'false');
    await boardGames.click();
    await expect(boardGames).toHaveAttribute('aria-expanded', 'true');
    await nav.getByRole('link', { name: 'Xếp hạng' }).click();
    await expect(page).toHaveURL(/\/leaderboard/);
    // The current area is marked, and the menu closed after navigating.
    await expect(boardGames).toHaveAttribute('data-current', 'true');
    await expect(nav.getByRole('link', { name: 'Xếp hạng' })).toBeHidden();

    const office = nav.getByRole('button', { name: 'Văn phòng' });
    await office.click();
    await page.keyboard.press('Escape');
    await expect(office).toHaveAttribute('aria-expanded', 'false');
    await office.click();
    await nav.getByRole('link', { name: 'Hoạt động' }).click();
    await expect(page).toHaveURL(/\/office$/);
    await expect(office).toHaveAttribute('data-current', 'true');
  });
});

test.describe('phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'the menu button is only shown on small screens');

  test('the menu groups both areas', async ({ page }) => {
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Menu' });
    await expect(menu).toHaveAttribute('aria-expanded', 'false');

    await menu.click();
    const panel = page.locator('#mobile-nav');
    await expect(panel.getByRole('group', { name: 'Board game' })).toBeVisible();
    await expect(panel.getByRole('group', { name: 'Văn phòng' })).toBeVisible();
    await panel.getByRole('link', { name: 'Xếp hạng' }).click();
    await expect(page).toHaveURL(/\/leaderboard/);
    await expect(panel).toBeHidden();

    await menu.click();
    await panel.getByRole('link', { name: 'Danh mục game' }).click();
    await expect(page).toHaveURL(/\/board-games$/);

    await menu.click();
    await panel.getByRole('link', { name: 'Thú của tôi' }).click();
    await expect(page).toHaveURL(/\/office\/avatar$/);

    await menu.click();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });
});
