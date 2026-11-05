import { expect, test, type Browser, type Page } from '@playwright/test';

async function newPage(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

async function names(page: Page): Promise<string[]> {
  return (await page.getByTestId('draw-winner').locator('.draw-winner-name').allTextContents()).map((s) =>
    s.trim(),
  );
}

async function setup(browser: Browser, absent: string[]) {
  const host = await newPage(browser);
  await host.goto('/office/new');
  await host.getByRole('button', { name: 'Tạo phiên' }).click();
  await expect(host).toHaveURL(/\/host$/);
  const code = (await host.getByTestId('host-code').textContent())!.trim();
  for (const name of absent) {
    await host.getByLabel('Thêm người vắng mặt').fill(name);
    await host.getByRole('button', { name: '+ Thêm' }).click();
    await expect(host.getByText(name, { exact: true })).toBeVisible();
  }
  return { host, code };
}

test('spotlight and claw machine land on the same winner everywhere', async ({ browser }) => {
  test.setTimeout(120_000);
  const { host, code } = await setup(browser, ['An', 'Bình', 'Chi', 'Dũng', 'Én']);
  const stage = await newPage(browser);
  await stage.goto(`/office/s/${code}/screen`);
  await expect(stage.getByTestId('stage-code')).toHaveText(code);

  for (const [mode, testId] of [
    ['Đèn sân khấu', 'draw-spotlight'],
    ['Máy gắp thú', 'draw-claw'],
  ] as const) {
    await host.getByRole('radio', { name: new RegExp(mode) }).click();
    await expect(host.getByRole('radio', { name: new RegExp(mode) })).toHaveAttribute('aria-checked', 'true');
    await host.getByTestId('draw-spin').click();
    await expect(stage.getByTestId(testId)).toBeVisible();
    await expect(stage.getByTestId('draw-winner')).toHaveCount(1, { timeout: 20_000 });
    const onStage = await names(stage);
    await expect(host.getByTestId('draw-winner')).toHaveCount(1, { timeout: 10_000 });
    expect(await names(host)).toEqual(onStage);
    await expect(host.getByTestId('draw-spin')).toBeEnabled();
  }
});

test('reactions from a phone float up on the stage; the phone can download its animal card', async ({
  browser,
}) => {
  const { host, code } = await setup(browser, []);
  const stage = await newPage(browser);
  await stage.goto(`/office/s/${code}/screen`);
  const phone = await newPage(browser);
  await phone.goto(`/office/s/${code}`);
  await phone.getByRole('button', { name: 'Vào phiên với con vật này' }).click();
  await expect(phone.getByTestId('participant-status')).toContainText('Bạn đã vào phiên');

  await phone.getByRole('button', { name: 'Gửi 🎉' }).click();
  await expect(stage.getByTestId('reaction')).toContainText('🎉');
  await expect(host.getByTestId('reaction')).toContainText('🎉');
  // Gone after a few seconds.
  await expect(stage.getByTestId('reaction')).toHaveCount(0, { timeout: 6_000 });

  const download = phone.waitForEvent('download');
  await phone.getByRole('button', { name: /Tải thẻ con vật/ }).click();
  expect((await download).suggestedFilename()).toMatch(/-animal\.png$/);
});

test('presentation mode: the host projects the stage, spins with Space and leaves with Esc', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const { host } = await setup(browser, ['An', 'Bình', 'Chi']);
  await host.getByTestId('host-present').click();
  const present = host.getByTestId('presentation');
  await expect(present).toBeVisible();
  await expect(host.getByTestId('draw-spin')).toHaveCount(0); // the console is hidden
  await host.locator('.office-stage-title').click();
  await host.keyboard.press('Space');
  await expect(present.getByTestId('draw-player')).toBeVisible();
  await expect(present.getByTestId('draw-winner')).toHaveCount(1, { timeout: 20_000 });
  await host.keyboard.press('Escape');
  await expect(present).toHaveCount(0);
  await expect(host.getByTestId('draw-spin')).toBeVisible();
});
