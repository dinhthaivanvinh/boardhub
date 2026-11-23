import { expect, test } from '@playwright/test';

test('the home page introduces chess and leads to learning, playing and the other games', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Học và chơi cờ vua, ngay trên trình duyệt',
  );
  await page.getByTestId('cta-learn').click();
  await expect(page).toHaveURL(/\/learn\/chess$/);

  await page.goto('/');
  await page.getByTestId('cta-play').click();
  await expect(page).toHaveURL(/\/games\/chess$/);

  await page.goto('/');
  await page.getByTestId('area-board-games').click();
  await expect(page).toHaveURL(/\/board-games$/);
  await expect(page.getByRole('link', { name: /Cờ vua/ })).toBeVisible();
});

test('the Office and Party areas are out of the menus but their pages still work', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Văn phòng')).toHaveCount(0);
  await expect(page.getByText('Tiệc nhóm')).toHaveCount(0);
  await page.goto('/office');
  await expect(page.getByRole('heading', { level: 1, name: 'Văn phòng' })).toBeVisible();
});

test('a missing room points back to the board games', async ({ page }) => {
  await page.goto('/room/ZZZZZZ');
  await expect(page.getByRole('link', { name: 'Về danh mục game' })).toHaveAttribute('href', '/board-games');
});

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop layout');

  test('header: Học cờ, Chơi cờ vua and Board game ▾', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Điều hướng' });
    await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();

    await nav.getByRole('link', { name: 'Học cờ' }).click();
    await expect(page).toHaveURL(/\/learn\/chess$/);
    await expect(nav.getByRole('link', { name: 'Học cờ' })).toHaveAttribute('data-current', 'true');

    const boardGames = nav.getByRole('button', { name: 'Board game' });
    await expect(boardGames).toHaveAttribute('aria-expanded', 'false');
    await boardGames.click();
    await expect(boardGames).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(boardGames).toHaveAttribute('aria-expanded', 'false');
    await boardGames.click();
    await nav.getByRole('link', { name: 'Xếp hạng' }).click();
    await expect(page).toHaveURL(/\/leaderboard/);
    // The current area is marked, and the menu closed after navigating.
    await expect(boardGames).toHaveAttribute('data-current', 'true');
    await expect(nav.getByRole('link', { name: 'Xếp hạng' })).toBeHidden();
    await expect(nav.getByRole('button', { name: 'Văn phòng' })).toHaveCount(0);
  });
});

test.describe('phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'the menu button is only shown on small screens');

  test('the menu lists learning, playing and the board games', async ({ page }) => {
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Menu' });
    await expect(menu).toHaveAttribute('aria-expanded', 'false');

    await menu.click();
    const panel = page.locator('#mobile-nav');
    await expect(panel.getByRole('group', { name: 'Board game' })).toBeVisible();
    await expect(panel.getByRole('group', { name: 'Văn phòng' })).toHaveCount(0);
    await panel.getByRole('link', { name: 'Xếp hạng' }).click();
    await expect(page).toHaveURL(/\/leaderboard/);
    await expect(panel).toBeHidden();

    await menu.click();
    await panel.getByRole('link', { name: 'Học cờ' }).click();
    await expect(page).toHaveURL(/\/learn\/chess$/);

    await menu.click();
    await panel.getByRole('link', { name: 'Danh mục game' }).click();
    await expect(page).toHaveURL(/\/board-games$/);

    await menu.click();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });
});
