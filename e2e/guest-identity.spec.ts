import { expect, test, type Page } from '@playwright/test';

/** The display name field on the account page holds the current guest's name. */
async function currentName(page: Page): Promise<string> {
  await page.goto('/account');
  const field = page.getByLabel('Tên hiển thị');
  await expect(field).not.toHaveValue('');
  return field.inputValue();
}

test('all tabs of one browser are the same guest; "new guest" switches every tab', async ({ browser }) => {
  const context = await browser.newContext();
  const tab1 = await context.newPage();
  const tab2 = await context.newPage();
  const first = await currentName(tab1);
  expect(await currentName(tab2)).toBe(first);

  await tab2.getByRole('button', { name: 'Chơi với tên khách mới' }).first().click();
  await expect(tab2.getByText('Bạn đang chơi với tên khách mới.')).toBeVisible();
  await expect(tab2.getByLabel('Tên hiển thị')).not.toHaveValue(first);
  const second = await tab2.getByLabel('Tên hiển thị').inputValue();

  // The other tab reloads on its own and is now the new guest too.
  await expect(tab1.getByLabel('Tên hiển thị')).toHaveValue(second, { timeout: 10_000 });
  await expect(tab1.getByRole('link', { name: second })).toBeVisible();
});

test('separate browsers are separate guests', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  expect(await currentName(a)).not.toBe(await currentName(b));
});

test('two different people with the same name are told apart in a room', async ({ browser }) => {
  const rename = async (page: Page) => {
    await currentName(page);
    await page.getByLabel('Tên hiển thị').fill('Trùng Tên');
    await page.getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByText('Đã lưu.')).toBeVisible();
  };
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await rename(a);
  await rename(b);

  await a.goto('/games/caro');
  await a.getByRole('radio', { name: 'Chơi online với bạn bè' }).check();
  await a.getByRole('button', { name: 'Tạo phòng' }).click();
  await expect(a).toHaveURL(/\/room\//);
  await b.goto(a.url());
  await b.getByTestId('seat-1').getByRole('button', { name: 'Ngồi vào đây' }).click();

  const seat0 = a.getByTestId('seat-0');
  const seat1 = a.getByTestId('seat-1');
  await expect(seat1).toContainText(/Trùng Tên #[0-9a-f]{4}/);
  await expect(seat0).toContainText(/Trùng Tên #[0-9a-f]{4} \(bạn\)/);
  const label0 = (await seat0.textContent())!.match(/#[0-9a-f]{4}/)![0];
  const label1 = (await seat1.textContent())!.match(/#[0-9a-f]{4}/)![0];
  expect(label0).not.toBe(label1);

  // Chat uses the same labels.
  await b.getByLabel('Nhập tin nhắn…').fill('chào');
  await b.getByRole('button', { name: 'Gửi' }).click();
  await expect(a.getByText(`Trùng Tên ${label1}:`)).toBeVisible();
});
