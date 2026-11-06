import { expect, test, type Browser, type Page } from '@playwright/test';

async function newPage(browser: Browser, reducedMotion: 'reduce' | 'no-preference' = 'no-preference') {
  return (await browser.newContext({ reducedMotion, viewport: { width: 1440, height: 900 } })).newPage();
}

/** Screenshots for a manual look, when SHOTS is set to a folder. */
const shot = async (page: Page, name: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
};

test('Lì xì: create the room, call people up one by one, every envelope from the pile', async ({
  browser,
}) => {
  test.skip(test.info().project.name !== 'desktop', 'a long multi-screen flow: desktop only');
  test.setTimeout(120_000);

  // The host opens the party area and sets the notes: 1 × 500.000 đ, 50.000 đ unlimited.
  const host = await newPage(browser);
  await host.goto('/party');
  await expect(host.getByRole('heading', { level: 1, name: 'Tiệc nhóm' })).toBeVisible();
  await host
    .getByTestId('party-game-li-xi')
    .getByRole('link', { name: /Chơi ngay/ })
    .click();
  await expect(host).toHaveURL(/\/party\/li-xi\/new$/);
  await host.getByLabel('Tên phòng').fill('Lì xì nhà mình');
  const rows = host.getByTestId('li-xi-row');
  await rows
    .nth(1)
    .getByRole('button', { name: /Bỏ dòng/ })
    .click();
  await expect(rows).toHaveCount(2);
  await expect(host.getByTestId('li-xi-preview-total')).toContainText('950.000');
  await host.getByRole('button', { name: 'Tạo phòng' }).click();
  await expect(host).toHaveURL(/\/party\/s\/[A-Z0-9]{6}\/host$/);
  const code = (await host.getByTestId('host-code').textContent())!.trim();

  // The projector: the Tết room, waiting.
  const stage = await newPage(browser);
  await stage.goto(`/party/s/${code}/screen`);
  await expect(stage.getByTestId('li-xi-stage')).toBeVisible();
  await expect(stage.getByTestId('li-xi-status')).toHaveText('Chờ người lì xì bắt đầu…');

  // A phone joins (an old /office link still lands in the party area); grandma has no phone.
  const phone = await newPage(browser);
  await phone.goto(`/office/s/${code}`);
  await expect(phone).toHaveURL(new RegExp(`/party/s/${code}$`));
  await phone.getByRole('button', { name: 'Vào phiên với con vật này' }).click();
  await expect(phone.getByTestId('li-xi-phone-status')).toHaveText('Chờ người lì xì bắt đầu…');
  await host.getByLabel('Thêm người vắng mặt').fill('Bà nội');
  await host.getByRole('button', { name: '+ Thêm', exact: true }).click();
  await expect(stage.getByTestId('li-xi-person')).toHaveCount(2);
  await expect(host.getByTestId('li-xi-host')).toContainText('Với 2 người đang chờ');
  await shot(stage, 'stage-waiting');
  await shot(host, 'host-settings');

  // Start, then call the first person: the light, the walk, the envelope, the note.
  await host.getByTestId('li-xi-act').click();
  await expect(host.getByTestId('li-xi-act')).toHaveText(/Mời người tiếp theo/);
  await host.getByTestId('li-xi-act').click();
  await expect(stage.getByTestId('li-xi-status')).toHaveText('Ai sẽ được gọi lên đây?');
  await expect(phone.getByTestId('li-xi-phone')).toContainText('Nhìn lên màn hình');
  await expect(host.getByTestId('li-xi-act')).toBeDisabled();
  await stage.waitForTimeout(2500);
  await shot(stage, 'stage-calling');
  await expect(stage.getByTestId('li-xi-envelope')).toBeVisible({ timeout: 15_000 });
  await shot(stage, 'stage-envelope');
  await expect(stage.getByTestId('li-xi-amount')).toBeVisible({ timeout: 10_000 });
  await stage.waitForTimeout(600);
  await shot(stage, 'stage-note');
  const first = (await stage.getByTestId('li-xi-receiver').textContent())!.trim();
  // The table shows it once the envelope is open; the host can call the next person when it is over.
  await expect(stage.getByTestId('li-xi-gifts')).toContainText(first);
  await expect(host.getByTestId('li-xi-act')).toBeEnabled({ timeout: 5_000 });
  await shot(phone, 'phone-after-first');

  // The second (and last) person.
  await host.getByTestId('li-xi-act').click();
  await expect(stage.getByTestId('li-xi-finale')).toBeVisible({ timeout: 20_000 });
  await expect(host.getByTestId('li-xi-all-done')).toBeVisible({ timeout: 5_000 });
  await shot(stage, 'stage-finale');

  // One 500.000 note and one 50.000: 550.000 đ in all, nothing left of the limited note.
  await expect(stage.getByTestId('li-xi-total')).toContainText('550.000');
  await expect(stage.getByTestId('li-xi-pile-row').first()).toContainText('còn 0 tờ');
  // The phone shows its own envelope (still open in hand if it was the last turn).
  await expect(phone.getByTestId('li-xi-phone')).toContainText(/(500|50)\.000/);

  // Each turn can be checked: the person and the envelope.
  const verify = await newPage(browser);
  await host.getByText('Kiểm chứng từng lượt').click();
  const href = await host
    .getByTestId('li-xi-host')
    .locator('a[href*="/verify/"]')
    .first()
    .getAttribute('href');
  await verify.goto(href!);
  await expect(verify.getByTestId('verify-verdict')).toHaveAttribute('data-ok', 'true');
  await expect(verify.getByTestId('verify-prizes')).toBeVisible();
});

test('Lì xì without animations: the result simply appears', async ({ browser }) => {
  test.skip(test.info().project.name !== 'desktop', 'desktop only');
  const host = await newPage(browser, 'reduce');
  await host.goto('/party/li-xi/new');
  await host.getByRole('button', { name: 'Tạo phòng' }).click();
  await expect(host).toHaveURL(/\/host$/);
  await host.getByLabel('Thêm người vắng mặt').fill('Ông ngoại');
  await host.getByRole('button', { name: '+ Thêm', exact: true }).click();
  await host.getByTestId('li-xi-act').click();
  await host.getByTestId('li-xi-act').click();
  await expect(host.getByTestId('li-xi-amount')).toBeVisible({ timeout: 10_000 });
  await expect(host.getByTestId('li-xi-amount')).toHaveText(/500\.000|200\.000|50\.000/);
});
