import { expect, test, type Page } from '@playwright/test';

/** Help against the computer in chess: a suggested move, and a warning about pieces in danger. */

const square = (page: Page, name: string) => page.locator(`[data-square="${name}"]`);

test('a hint points at a move that can be played, and goes away once played', async ({ page }) => {
  await page.goto('/play/chess?mode=bot&level=easy');
  const hint = page.getByTestId('coach-hint');
  await expect(hint).toBeEnabled();
  await hint.click();
  await expect(page.getByTestId('coach-message')).toContainText(/từ [a-h][1-8] đến [a-h][1-8]/);
  const marked = page.locator('[data-hint="true"]');
  await expect(marked).toHaveCount(2);

  const [from, to] = (await page.getByTestId('coach-message').textContent())!.match(/[a-h][1-8]/g)!;
  await square(page, from!).click();
  await square(page, to!).click();
  await expect(square(page, to!)).toHaveAttribute('data-piece', /^w/);
  await expect(marked).toHaveCount(0);
});

test('there is no help between two people, nor in a game without a coach', async ({ page }) => {
  await page.goto('/play/chess?mode=local');
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.getByTestId('coach-hint')).toHaveCount(0);
  await page.goto('/play/caro?mode=bot&level=easy');
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.getByTestId('coach-hint')).toHaveCount(0);
});

test('the warning can be turned off, and stays off', async ({ page }) => {
  await page.goto('/play/chess?mode=bot&level=easy');
  await page.getByText('Cài đặt', { exact: false }).first().click();
  const box = page.getByRole('checkbox', { name: 'Cảnh báo quân đang bị đe doạ' });
  await expect(box).toBeChecked();
  await box.uncheck();
  await page.reload();
  await page.getByText('Cài đặt', { exact: false }).first().click();
  await expect(box).not.toBeChecked();
});

test('three hints a game: the third says it is the last, a new game gives them back', async ({ page }) => {
  await page.goto('/play/chess?mode=bot&level=easy');
  const hint = page.getByTestId('coach-hint');
  const message = page.getByTestId('coach-message');
  const last = 'Đây là gợi ý cuối cùng trong ván này.';
  for (const left of [3, 2, 1]) {
    await expect(hint).toBeEnabled({ timeout: 10_000 });
    await expect(hint).toContainText(`còn ${left}`);
    await hint.click();
    await expect(message).toContainText(/từ [a-h][1-8] đến [a-h][1-8]/);
    if (left > 1) await expect(message).not.toContainText(last);
    else await expect(message).toContainText(last);
    const [from, to] = (await message.textContent())!.match(/từ ([a-h][1-8]) đến ([a-h][1-8])/)!.slice(1);
    await square(page, from!).click();
    await square(page, to!).click();
  }
  await expect(hint).toContainText('còn 0');
  await expect(hint).toBeDisabled();
  // Taking a move back does not give a hint back.
  await page.getByRole('button', { name: /Đi lại/ }).click();
  await expect(hint).toContainText('còn 0');
  await page.getByRole('button', { name: /Ván mới/ }).click();
  await expect(hint).toContainText('còn 3');
  await expect(hint).toBeEnabled();
});

test('a hint is read aloud from the recordings, unless that is turned off', async ({ page }) => {
  const played: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('.mp3') && r.url().includes('/audio/vi-edge/')) played.push(r.url());
  });
  await page.goto('/play/chess?mode=bot&level=easy');
  await page.waitForLoadState('networkidle');
  await page.getByTestId('coach-hint').click();
  // The reason, the piece and two squares: the parts load one after the other.
  await expect.poll(() => new Set(played).size, { timeout: 20_000 }).toBeGreaterThanOrEqual(4);

  await page.getByText('Cài đặt', { exact: false }).first().click();
  await page.getByRole('checkbox', { name: 'Đọc to cảnh báo và gợi ý' }).uncheck();
  await expect(page.getByRole('button', { name: /Nghe lại/ })).toHaveCount(0);
});
