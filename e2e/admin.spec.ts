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
  // Another test registered the admin at the same moment: sign in to that account.
  if (!res.ok()) res = await page.request.post(`${SERVER}/api/auth/login`, { data: body });
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
  // The header of the children's pages leads there for an admin.
  await admin.goto('/');
  await admin.getByTestId('admin-link').click();
  await expect(admin.getByTestId('admin-bell')).toBeVisible();
  const menu = admin.getByTestId('admin-menu');
  if (await menu.isVisible()) await menu.click();
  await admin.getByTestId('admin-nav-reports').click();
  await expect(admin.getByTestId('admin-tab-open')).toBeVisible();
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
  await admin.goto('/admin/reports');
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
  await admin.goto('/admin/settings/games');
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

test('the admin sees how many people came today, split by who was signed in', async ({ browser }) => {
  // A visitor who is not signed in, so every kind has someone.
  const visitor = await newPlayer(browser);
  await visitor.goto('/');
  const admin = await adminPage(browser);
  await admin.goto('/admin/visitors');
  await expect(admin.getByTestId('admin-stats')).toBeVisible();
  // The pings come a moment after the pages open: read again until they are in.
  await expect(async () => {
    await admin.getByRole('button', { name: 'Làm mới' }).click();
    await expect(admin.getByTestId('stats-today-anonymous')).toContainText(/[1-9]\d*$/);
    await expect(admin.getByTestId('stats-today-registered')).toContainText(/[1-9]\d*$/);
    await expect(admin.getByTestId('stats-total')).toContainText(/[1-9]\d*$/);
  }).toPass({ timeout: 15_000 });
  await expect(admin.getByTestId('stats-days').locator('tbody tr')).toHaveCount(14);
});

test('the dashboard shows real numbers, and the range filter changes what it covers', async ({ browser }) => {
  const admin = await adminPage(browser);
  await admin.goto('/admin');
  await expect(admin.getByTestId('admin-dashboard')).toBeVisible();
  // The admin's own account at least.
  await expect(admin.getByTestId('card-registered')).toContainText(/[1-9]/);
  await expect(admin.getByTestId('admin-recent').locator('li').first()).toBeVisible();
  // The menu button is for phones only: elsewhere the menu is always there.
  const narrow = admin.viewportSize()!.width < 768;
  await expect(admin.getByTestId('admin-menu')).toBeVisible({ visible: narrow });
  // The frame of the children's pages is not here.
  await expect(admin.locator('.site-header, .site-footer')).toHaveCount(0);

  const week = admin.waitForResponse((r) => r.url().includes('/api/admin/overview'));
  await admin.getByTestId('range-d7').click();
  expect((await week).status()).toBe(200);
  await expect(admin.getByTestId('range-d7')).toHaveAttribute('aria-pressed', 'true');
  await expect(admin.getByText('(7 ngày)')).toBeVisible();

  // A range the wrong way round is refused on the page.
  await admin.getByTestId('range-custom').click();
  await admin.getByTestId('range-from').fill('2020-01-01');
  await admin.getByTestId('range-apply').click();
  await expect(admin.getByRole('alert').filter({ hasText: 'không quá 90 ngày' })).toBeVisible();

  // Nothing scrolls sideways, whatever the width.
  const overflow = await admin.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the visitor numbers can be saved as a CSV file', async ({ browser }) => {
  const admin = await adminPage(browser);
  await admin.goto('/admin/visitors');
  const download = admin.waitForEvent('download');
  await admin.getByTestId('stats-export').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^boardhub-visitors-[\d-]+_[\d-]+\.csv$/);
  const text = await (
    await file.createReadStream()
  )
    .toArray()
    .then((chunks) => Buffer.concat(chunks).toString());
  const lines = text.trim().split('\r\n');
  expect(lines[0]).toContain('Tổng số người');
  expect(lines).toHaveLength(15);
});

test('signing out from the admin header goes home and closes the admin area', async ({ browser }) => {
  const admin = await adminPage(browser);
  // The session is put back on every new page by the helper, so this checks the page that signed out.
  await admin.goto('/admin');
  await admin.getByTestId('admin-profile').click();
  await admin.getByTestId('admin-logout').click();
  await expect(admin).toHaveURL(/\/$/);
  await expect(admin.getByTestId('admin-link')).toBeHidden();
});
