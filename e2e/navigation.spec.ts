import { expect, test } from '@playwright/test';

test('the home page introduces chess and leads to learning, playing and the other games', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Bắt đầu hành trình trở thành kiện tướng nhí!',
  );
  await page.getByTestId('cta-learn').click();
  await expect(page).toHaveURL(/\/learn\/chess\/coordinates$/);

  await page.goto('/');
  await page.getByTestId('cta-play').click();
  await expect(page).toHaveURL(/\/games\/chess$/);

  // The home page no longer shows the other games or the join-room form.
  await page.goto('/');
  await expect(page.getByTestId('area-board-games')).toHaveCount(0);
  await expect(page.getByPlaceholder('Mã 6 ký tự')).toHaveCount(0);

  await page.goto('/board-games');
  await expect(page.getByRole('link', { name: /Cờ vua/ })).toBeVisible();
});

test('the old list of lessons is gone: its address leads to the home page', async ({ page }) => {
  await page.goto('/learn/chess');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('cta-learn')).toBeVisible();
});

test('a lesson goes back to the home page', async ({ page }) => {
  await page.goto('/learn/chess/coordinates');
  await page.getByRole('link', { name: 'Về trang chủ' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('the Office and Party areas are out of the menus but their pages still work', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Văn phòng')).toHaveCount(0);
  await expect(page.getByText('Tiệc nhóm')).toHaveCount(0);
  await page.goto('/office');
  await expect(page.getByRole('heading', { level: 1, name: 'Văn phòng' })).toBeVisible();
});

test('the footer lists the places to explore, each with its real address', async ({ page }) => {
  await page.goto('/about');
  const explore = page.getByRole('navigation', { name: 'Khám phá' });
  for (const [link, path] of [
    ['Học cờ', '/learn/chess/coordinates'],
    ['Câu đố', '/puzzles'],
    ['Hành trình', '/journey'],
    ['Chơi cờ vua', '/games/chess'],
    ['Board game', '/board-games'],
  ] as const) {
    await expect(explore.getByRole('link', { name: link })).toHaveAttribute('href', path);
  }
  await expect(explore.getByRole('link')).toHaveCount(5);
  await explore.getByRole('link', { name: 'Board game' }).click();
  await expect(page).toHaveURL(/\/board-games$/);
});

test('the footer leads to the pages about the site', async ({ page }) => {
  await page.goto('/');
  const info = page.getByRole('navigation', { name: 'Thông tin' });
  await expect(info.getByRole('link')).toHaveCount(4);
  for (const [link, path, heading] of [
    ['Giới thiệu', '/about', 'Giới thiệu BoardHub'],
    ['Liên hệ', '/contact', 'Liên hệ'],
    ['Quyền riêng tư', '/privacy', 'Chính sách quyền riêng tư'],
    ['Điều khoản', '/terms', 'Điều khoản sử dụng'],
  ] as const) {
    await info.getByRole('link', { name: link }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
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
    await expect(page).toHaveURL(/\/learn\/chess\/coordinates$/);
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
    await expect(page).toHaveURL(/\/learn\/chess\/coordinates$/);

    await menu.click();
    await panel.getByRole('link', { name: 'Danh mục game' }).click();
    await expect(page).toHaveURL(/\/board-games$/);

    await menu.click();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });
});
