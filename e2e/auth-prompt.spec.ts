import { expect, test } from '@playwright/test';

// A browser that has never chosen: no "always play as a guest" flag, no session.
test.use({ storageState: { cookies: [], origins: [] } });

test('creating a room asks first; "play as a guest" then goes on', async ({ page }) => {
  await page.goto('/games/caro');
  await page.getByRole('radio', { name: 'Chơi online với bạn bè' }).check();
  await page.getByRole('button', { name: 'Tạo phòng' }).click();
  const prompt = page.getByTestId('auth-prompt');
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText('Chơi bằng tài khoản nào?');
  await prompt.getByLabel('Tên hiển thị (không bắt buộc)').fill('Khách Thử');
  await prompt.getByTestId('auth-guest').click();
  await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}$/);
  await expect(prompt).toBeHidden();
  await expect(page.getByTestId('seat-0')).toContainText('Khách Thử');
});

test('registering from the question signs you in', async ({ page }) => {
  await page.goto('/profile');
  const prompt = page.getByTestId('auth-prompt');
  await prompt.getByRole('tab', { name: 'Đăng ký' }).click();
  await prompt.getByLabel('Tên hiển thị', { exact: true }).fill('Người Mới');
  await prompt
    .getByLabel('Email')
    .fill(`new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`);
  await prompt.getByLabel('Mật khẩu').fill('secret-1234');
  await prompt.getByTestId('auth-submit').click();
  await expect(prompt).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'Người Mới' })).toBeVisible();
});

test('closing the question makes nothing; local games never ask', async ({ page }) => {
  await page.goto('/profile');
  const prompt = page.getByTestId('auth-prompt');
  await expect(prompt).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(prompt).toBeHidden();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Hãy đăng nhập hoặc chọn chơi với tên khách' }),
  ).toBeVisible();
  const token = await page.evaluate(
    () =>
      (JSON.parse(localStorage.getItem('bg-session') ?? '{}') as { state?: { token?: string } }).state
        ?.token ?? null,
  );
  expect(token).toBeNull();

  await page.goto('/play/caro?mode=bot&level=easy');
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(prompt).toBeHidden();
});

test('"do not ask again" makes the next guest without the question', async ({ page }) => {
  await page.goto('/account');
  await page.getByLabel('Lần sau không hỏi lại trên trình duyệt này').check();
  await page.getByTestId('auth-guest').click();
  await expect(page.getByRole('button', { name: 'Chơi với tên khách mới' })).toBeVisible();
  // Forget the session (as if the server forgot this guest): a new guest comes without asking.
  await page.evaluate(() => localStorage.removeItem('bg-session'));
  await page.goto('/profile');
  await expect(page.getByTestId('stat-played')).toHaveText('0');
  await expect(page.getByTestId('auth-prompt')).toBeHidden();
});
