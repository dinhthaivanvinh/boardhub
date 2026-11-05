import { expect, test, type Browser, type Page } from '@playwright/test';

async function newPage(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

test('host, projector and phones: create, join, lock, absent people, kick', async ({ browser }) => {
  // The host starts a session from the office page.
  const host = await newPage(browser);
  await host.goto('/office');
  await host.getByRole('link', { name: 'Tạo phiên' }).first().click();
  await expect(host).toHaveURL(/\/office\/new$/);
  await host.getByRole('button', { name: 'Ai đi mua trà sữa?' }).click();
  await host.getByRole('button', { name: 'Tạo phiên' }).click();
  await expect(host).toHaveURL(/\/office\/s\/[A-Z0-9]{6}\/host$/);
  const code = (await host.getByTestId('host-code').textContent())!.trim();
  await expect(host.getByRole('heading', { level: 1 })).toHaveText('Ai đi mua trà sữa?');
  await expect(host.getByTestId('office-qr').locator('svg')).toBeVisible();

  // The projector shows the code, the QR and an empty stage.
  const stage = await newPage(browser);
  await stage.goto(`/office/s/${code}/screen`);
  await expect(stage.getByTestId('stage-code')).toHaveText(code);
  await expect(stage.getByText('Đang chờ người đầu tiên vào…')).toBeVisible();

  // A phone joins with its animal; it shows up on the stage and in the host's list.
  const an = await newPage(browser);
  await an.goto(`/office/s/${code}`);
  await expect(an.getByRole('heading', { level: 1 })).toHaveText('Ai đi mua trà sữa?');
  await an.getByRole('button', { name: 'Vào phiên với con vật này' }).click();
  await expect(an.getByTestId('participant-status')).toContainText('Bạn đã vào phiên');
  await expect(stage.getByTestId('herd-animal')).toHaveCount(1);
  await expect(host.getByTestId('host-participant')).toHaveCount(1);
  await expect(host.getByTestId('host-count')).toContainText('1 người đã vào');

  // Someone without a phone, added by the host.
  await host.getByLabel('Thêm người vắng mặt').fill('Chi nghỉ phép');
  await host.getByRole('button', { name: '+ Thêm' }).click();
  await expect(stage.getByTestId('herd-animal')).toHaveCount(2);
  await expect(stage.getByText('Chi nghỉ phép')).toBeVisible();

  // Locked: a newcomer cannot get in.
  await host.getByRole('button', { name: /Khoá phiên/ }).click();
  await expect(stage.getByText(/Đã khoá/)).toBeVisible();
  const late = await newPage(browser);
  await late.goto(`/office/s/${code}`);
  await late.getByRole('button', { name: 'Vào phiên với con vật này' }).click();
  await expect(late.getByText('Phiên đã khoá, bạn không vào được.')).toBeVisible();

  // The phone that was in can come back after a reload.
  await an.reload();
  await expect(an.getByTestId('participant-status')).toContainText('Bạn đã vào phiên');
  await expect(host.getByTestId('host-participant')).toHaveCount(2);

  // Kick: gone from the stage, and told on the phone.
  const anName = (await an.getByTestId('my-name').textContent())!.trim();
  await host.getByRole('button', { name: `Mời ${anName} ra khỏi phiên` }).click();
  await expect(stage.getByTestId('herd-animal')).toHaveCount(1);
  await expect(an.getByText('Phiên đã khoá hoặc bạn đã được mời ra.')).toBeVisible();
});

test('the portal code box opens an office session', async ({ browser }) => {
  const host = await newPage(browser);
  await host.goto('/office/new');
  await host.getByRole('button', { name: 'Tạo phiên' }).click();
  await expect(host).toHaveURL(/\/host$/);
  const code = (await host.getByTestId('host-code').textContent())!.trim();

  const guest = await newPage(browser);
  await guest.goto('/');
  await guest.getByLabel(/Có mã phòng/).fill(code);
  await guest.getByRole('button', { name: 'Vào phòng' }).click();
  await expect(guest).toHaveURL(new RegExp(`/office/s/${code}$`));
  await expect(guest.getByRole('button', { name: 'Vào phiên với con vật này' })).toBeVisible();
});

test('an unknown session code shows a friendly message', async ({ page }) => {
  await page.goto('/office/s/QQQQQQ');
  await expect(page.getByText('Không tìm thấy phiên này. Kiểm tra lại mã nhé.')).toBeVisible();
});
