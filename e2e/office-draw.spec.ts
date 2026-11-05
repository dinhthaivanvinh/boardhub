import { expect, test, type Browser, type Page } from '@playwright/test';

async function newPage(browser: Browser, reducedMotion: 'reduce' | 'no-preference' = 'no-preference') {
  return (await browser.newContext({ reducedMotion })).newPage();
}

async function names(page: Page): Promise<string[]> {
  return (await page.getByTestId('draw-winner').locator('.draw-winner-name').allTextContents()).map((s) =>
    s.trim(),
  );
}

test('Thú may mắn: the host spins, the stage and every phone show the same winner, and it verifies', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const host = await newPage(browser);
  await host.goto('/office/new');
  await host.getByRole('button', { name: 'Tạo phiên' }).click();
  await expect(host).toHaveURL(/\/host$/);
  const code = (await host.getByTestId('host-code').textContent())!.trim();

  const stage = await newPage(browser);
  await stage.goto(`/office/s/${code}/screen`);
  // A second projector without animations: the result simply appears.
  const calm = await newPage(browser, 'reduce');
  await calm.goto(`/office/s/${code}/screen`);

  const phones: Page[] = [];
  for (let i = 0; i < 2; i++) {
    const p = await newPage(browser);
    await p.goto(`/office/s/${code}`);
    await p.getByRole('button', { name: 'Vào phiên với con vật này' }).click();
    await expect(p.getByTestId('participant-status')).toContainText('Bạn đã vào phiên');
    phones.push(p);
  }
  await host.getByLabel('Thêm người vắng mặt').fill('Chi nghỉ phép');
  await host.getByRole('button', { name: '+ Thêm' }).click();
  await expect(host.getByTestId('draw-pool')).toContainText('Bốc trong 3 người');

  // Round 1: the race.
  await host.getByTestId('draw-spin').click();
  await expect(stage.getByTestId('draw-race')).toBeVisible();
  await expect(calm.getByTestId('draw-player')).toBeVisible();
  await expect(calm.getByTestId('draw-race')).toHaveCount(0);
  for (const p of phones) await expect(p.getByTestId('participant-draw')).toContainText('Đang quay');
  await expect(stage.getByTestId('draw-winner')).toHaveCount(1, { timeout: 20_000 });
  const first = await names(stage);
  await expect(host.getByTestId('draw-winner')).toHaveCount(1, { timeout: 10_000 });
  expect(await names(host)).toEqual(first);
  expect(await names(calm)).toEqual(first);
  let winnerPhones = 0;
  for (const p of phones) {
    const box = p.getByTestId('participant-draw');
    await expect(box).not.toContainText('Đang quay', { timeout: 10_000 });
    if ((await box.getAttribute('data-won')) === 'true') {
      winnerPhones++;
      await expect(box).toContainText('Bạn được chọn!');
    } else {
      await expect(p.getByTestId('participant-winner')).toHaveText(first[0]!);
    }
  }
  expect(winnerPhones).toBeLessThanOrEqual(1);

  // Round 2: the wheel, started with Space. The first winner is left out by default.
  await expect(host.getByTestId('draw-pool')).toContainText('Bốc trong 2 người');
  await host.getByRole('radio', { name: /Vòng quay/ }).click();
  await expect(host.getByRole('radio', { name: /Vòng quay/ })).toHaveAttribute('aria-checked', 'true');
  await host.locator('body').click({ position: { x: 5, y: 5 } });
  await host.keyboard.press('Space');
  await expect(stage.getByTestId('draw-wheel')).toBeVisible();
  await expect(stage.getByTestId('draw-winner')).toHaveCount(1, { timeout: 20_000 });
  const second = await names(stage);
  expect(second[0]).not.toBe(first[0]);
  await expect(host.getByTestId('draw-history')).toContainText(first[0]!);

  // Anyone can check the draw: the browser recomputes it.
  const href = await stage.getByRole('link', { name: /Kiểm chứng/ }).getAttribute('href');
  expect(href).toMatch(new RegExp(`^/office/s/${code}/verify/[0-9a-f-]{36}$`));
  const verify = await newPage(browser);
  await verify.goto(href!);
  await expect(verify.getByTestId('verify-verdict')).toHaveAttribute('data-ok', 'true');
  await expect(verify.getByText('Công bằng — kết quả khớp')).toBeVisible();
  await expect(verify.getByText(second[0]!).first()).toBeVisible();
});
