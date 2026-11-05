import { expect, test, type Page } from '@playwright/test';

const preview = (page: Page) => page.getByRole('img', { name: /: / }).first();
const saved = (page: Page) => expect(page.getByTestId('save-state')).toHaveText('✓ Đã lưu');

test('dress up your animal; it is saved to your profile and comes back after a reload', async ({ page }) => {
  await page.goto('/office/avatar');
  await expect(page.getByRole('heading', { level: 1, name: 'Thú của tôi' })).toBeVisible();
  await expect(preview(page)).toBeVisible();

  // Animal: owl.
  await page.getByRole('button', { name: 'Cú', exact: true }).click();
  await expect(preview(page)).toHaveAttribute('data-species', 'owl');
  await expect(page.getByRole('button', { name: 'Cú', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // Colours: blue fur.
  await page.getByRole('tab', { name: 'Màu' }).click();
  await page.getByRole('group', { name: 'Màu chính' }).getByRole('button', { name: 'Xanh dương' }).click();
  await expect(
    page.getByRole('group', { name: 'Màu chính' }).getByRole('button', { name: 'Xanh dương' }),
  ).toHaveAttribute('aria-pressed', 'true');

  // Accessory: headphones.
  await page.getByRole('tab', { name: 'Phụ kiện' }).click();
  await page.getByRole('button', { name: 'Tai nghe' }).click();
  await saved(page);

  await page.reload();
  await expect(preview(page)).toHaveAttribute('data-species', 'owl');
  await page.getByRole('tab', { name: 'Phụ kiện' }).click();
  await expect(page.getByRole('button', { name: 'Tai nghe' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: 'Màu' }).click();
  await expect(
    page.getByRole('group', { name: 'Màu chính' }).getByRole('button', { name: 'Xanh dương' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('undo and random', async ({ page }) => {
  await page.goto('/office/avatar');
  const undo = page.getByRole('button', { name: /Hoàn tác/ });
  await expect(undo).toBeDisabled();
  await page.getByRole('button', { name: 'Ếch', exact: true }).click();
  await page.getByRole('button', { name: 'Gấu trúc', exact: true }).click();
  await expect(preview(page)).toHaveAttribute('data-species', 'panda');
  await undo.click();
  await expect(preview(page)).toHaveAttribute('data-species', 'frog');

  // Random always gives a valid animal, and it is saved too.
  await page.getByRole('button', { name: /Ngẫu nhiên/ }).click();
  await expect(preview(page)).toHaveAttribute(
    'data-species',
    /^(cat|dog|fox|panda|rabbit|bear|penguin|frog|owl|tiger)$/,
  );
  await saved(page);
});
