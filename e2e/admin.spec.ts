import { expect, test, type Browser, type Page } from '@playwright/test';

// The e2e game server lists this email in ADMIN_EMAILS (playwright.config.ts).
const ADMIN_EMAIL = 'admin-e2e@example.com';
const SERVER = 'http://localhost:4000';

interface Auth {
  token: string;
  user: { id: string; displayName: string; admin: boolean };
}

/** Signs the admin in (registering the first time) and returns a page that uses that session. */
async function adminPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  const body = { email: ADMIN_EMAIL, password: 'admin-e2e-secret' };
  let res = await page.request.post(`${SERVER}/api/auth/login`, { data: body });
  if (!res.ok())
    res = await page.request.post(`${SERVER}/api/auth/register`, { data: { ...body, displayName: 'Admin' } });
  const auth = (await res.json()) as Auth;
  expect(auth.user.admin).toBe(true);
  await page.addInitScript((state) => {
    localStorage.setItem('bg-session', JSON.stringify({ state, version: 0 }));
  }, auth);
  return page;
}

const newPlayer = async (browser: Browser) => (await browser.newContext()).newPage();

/** Alice hosts a Caro room, Bob joins and writes `line` in the chat. */
async function roomWithChat(browser: Browser, line: string) {
  const alice = await newPlayer(browser);
  const bob = await newPlayer(browser);
  await alice.goto('/games/caro');
  await alice.getByRole('radio', { name: 'Chơi online với bạn bè' }).check();
  await alice.getByRole('button', { name: 'Tạo phòng' }).click();
  await expect(alice).toHaveURL(/\/room\/[A-Z0-9]{6}$/);
  const code = (await alice.getByTestId('room-code').textContent())!.trim();
  await bob.goto(`/room/${code}`);
  await bob.getByLabel('Nhập tin nhắn…').fill(line);
  await bob.getByRole('button', { name: 'Gửi' }).click();
  await expect(alice.getByText(line)).toBeVisible();
  return { alice, bob, code };
}

async function report(page: Page, reason: string) {
  await page.getByTestId('report-open').click();
  await page.getByRole('radio', { name: reason }).check();
  await page.getByTestId('report-send').click();
  await expect(page.getByTestId('report-sent')).toBeVisible();
  await page.getByRole('button', { name: 'Đóng' }).last().click();
}

/** The open report whose evidence contains `line`. */
const reportCard = (admin: Page, line: string) =>
  admin.getByTestId('admin-report').filter({ has: admin.getByTestId('admin-evidence').getByText(line) });

test('a reported player is muted by an admin, then unmuted', async ({ browser }) => {
  const line = `đồ ngốc ${Date.now()}`;
  const { alice, bob } = await roomWithChat(browser, line);
  await report(alice, 'Lăng mạ, quấy rối');

  const admin = await adminPage(browser);
  await admin.goto('/admin');
  await expect(admin.getByTestId('admin-link')).toBeVisible();
  const card = reportCard(admin, line);
  await expect(card).toBeVisible();
  await expect(card).toContainText('Lăng mạ, quấy rối');
  await card.getByTestId('admin-mute').click();
  await expect(card).toBeHidden();

  // Bob can no longer chat.
  await bob.getByLabel('Nhập tin nhắn…').fill('còn nói được không?');
  await bob.getByRole('button', { name: 'Gửi' }).click();
  await expect(bob.getByRole('alert').filter({ hasText: 'Bạn đang bị cấm chat.' })).toBeVisible();

  // The handled report and the mute are listed; lifting the mute lets Bob talk again.
  await admin.getByTestId('admin-tab-resolved').click();
  await expect(reportCard(admin, line)).toContainText('Đã xử lý: Cấm chat');
  await admin.getByTestId('admin-tab-sanctions').click();
  const bobName = await bob.evaluate(
    () => (JSON.parse(localStorage.getItem('bg-session')!) as { state: Auth }).state.user.displayName,
  );
  const row = admin.getByTestId('admin-sanctioned').filter({ hasText: bobName });
  await expect(row).toContainText('Cấm chat');
  await row.getByRole('button', { name: 'Gỡ cấm chat' }).click();
  await expect(row).toBeHidden();
  await bob.getByLabel('Nhập tin nhắn…').fill('xin lỗi mọi người');
  await bob.getByRole('button', { name: 'Gửi' }).click();
  await expect(alice.getByText('xin lỗi mọi người')).toBeVisible();
});

test('a banned player is shown why and cannot rejoin', async ({ browser }) => {
  const line = `gian lận ${Date.now()}`;
  const { alice, bob } = await roomWithChat(browser, line);
  await report(alice, 'Gian lận (dùng máy, phần mềm hỗ trợ)');

  const admin = await adminPage(browser);
  await admin.goto('/admin');
  const card = reportCard(admin, line);
  await card.getByTestId('admin-duration').selectOption({ label: '24 giờ' });
  await card.getByTestId('admin-ban').click();
  await card.getByTestId('admin-ban-confirm').click();
  await expect(card).toBeHidden();

  await bob.reload();
  await expect(bob.getByTestId('banned-banner')).toContainText('Tài khoản này đã bị khoá');
  // Signing out leaves the banned account behind.
  await bob.getByTestId('banned-banner').getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(bob.getByTestId('banned-banner')).toBeHidden();
});

test('the admin page is closed to players', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByTestId('admin-denied')).toBeVisible();
  await expect(page.getByTestId('admin-link')).toBeHidden();
});

test('admins see every game with its switch', async ({ browser }) => {
  const admin = await adminPage(browser);
  await admin.goto('/admin');
  await admin.getByTestId('admin-tab-games').click();
  for (const id of ['caro', 'chess', 'xiangqi'])
    await expect(admin.getByTestId(`admin-game-${id}`)).toBeVisible();
});

test('a paused game is marked in the catalog and cannot start', async ({ page }) => {
  // Turning a real game off would disturb the other tests running at the same time, so the status is faked
  // here; the server side is covered by apps/server/test/admin.test.ts.
  await page.route('**/api/games/status', (route) => route.fulfill({ json: { disabled: ['caro'] } }));
  await page.goto('/board-games');
  await expect(page.getByTestId('paused-caro')).toBeVisible();
  await expect(page.getByTestId('paused-chess')).toBeHidden();

  await page.goto('/games/caro');
  await expect(page.getByTestId('game-paused')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bắt đầu' })).toBeDisabled();

  await page.goto('/play/caro?mode=local');
  await expect(page.getByTestId('game-paused')).toBeVisible();
});
