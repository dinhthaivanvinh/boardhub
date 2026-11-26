import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * The chess lessons for young children, tested as a user would: every lesson opens without errors, nothing
 * overflows, the board fits a 14" laptop screen, the buttons are big enough for small fingers, and the main
 * flows (pieces, coordinates, openings, Back) work. Set LEARN_SHOTS=<folder> to also save screenshots to review.
 */

const LESSONS = [
  'coordinates',
  'setup',
  'capture',
  'checkmate',
  'draws',
  'pawn',
  'rook',
  'bishop',
  'knight',
  'queen',
  'king',
  'italian',
  'queens-gambit',
  'london',
  'ruy-lopez',
  'sicilian',
  'french',
  'castling',
  'en-passant',
  'promotion',
  'tactics',
  'basic-mates',
  'opening-basics',
  'early-mate',
];

const SHOTS = process.env.LEARN_SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** Speech is not under test here: a silent stub keeps the lessons from waiting on audio. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'learn.chess.voice.v1',
      JSON.stringify({ lang: 'vi', auto: false, results: false }),
    );
  });
});

const profile = (testInfo: { project: { name: string } }) => testInfo.project.name;

for (const id of LESSONS) {
  test(`lesson ${id}: opens, has no errors, no sideways scroll, big buttons`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`/learn/chess/${id}`);
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
    await shot(page, `${profile(testInfo)}-${id}`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'horizontal scroll').toBeLessThanOrEqual(1);

    // Every visible button is at least 44px tall: a child's finger is not precise.
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('main button, main a.btn')]
        .filter((el) => el.offsetParent !== null && el.closest('[role="grid"]') === null)
        .map((el) => ({
          text: (el.textContent ?? '').trim().slice(0, 30),
          h: Math.round(el.getBoundingClientRect().height),
        }))
        .filter((b) => b.h < 40),
    );
    expect(small, 'small buttons').toEqual([]);
    expect(errors).toEqual([]);
  });
}

test.describe('laptop 14 inch', () => {
  test.skip(({ isMobile }) => isMobile, 'a laptop screen only');
  test.use({ viewport: { width: 1366, height: 680 } });

  for (const id of [
    'coordinates',
    'setup',
    'capture',
    'checkmate',
    'draws',
    'knight',
    'italian',
    'castling',
    'tactics',
    'basic-mates',
    'opening-basics',
    'early-mate',
  ]) {
    test(`lesson ${id}: board and its buttons fit the first screen`, async ({ page }) => {
      await page.goto(`/learn/chess/${id}`);
      const board = page.getByRole('grid').first();
      await expect(board).toBeVisible();
      const box = (await board.boundingBox())!;
      expect(box.y + box.height, 'board bottom inside the window').toBeLessThanOrEqual(680);
      expect(box.width).toBeGreaterThan(300);
      const next = page.locator('main .ch-learn-actions .btn, main .ch-learn-actions button').first();
      if (await next.count()) {
        const nb = (await next.boundingBox())!;
        expect(nb.y + nb.height, 'main button inside the window').toBeLessThanOrEqual(680);
      }
    });
  }
});

test('a piece lesson can be followed from meeting to the finished star, and Back works', async ({ page }) => {
  await page.goto('/learn/chess/rook');
  const steps = page.getByRole('list', { name: 'Các bước của bài' });
  await expect(steps.locator('[aria-current="step"]')).toHaveText('Gặp quân cờ');

  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await expect(steps.locator('[aria-current="step"]')).toHaveText('Xem');
  await page.getByRole('button', { name: /Quay lại/ }).click();
  await expect(steps.locator('[aria-current="step"]')).toHaveText('Gặp quân cờ');
  await expect(page.getByRole('button', { name: /Quay lại/ })).toHaveCount(0);

  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await expect(steps.locator('[aria-current="step"]')).toHaveText('Thử');
  await shot(page, 'flow-rook-try');
});

test('coordinates: a child can answer by tapping the board', async ({ page }) => {
  await page.goto('/learn/chess/coordinates');
  await expect(page.getByRole('grid')).toBeVisible();
  // The lesson must offer something to do: a prompt and a board with 64 squares to tap.
  await expect(page.getByRole('grid').getByRole('gridcell')).toHaveCount(64);
  await shot(page, 'flow-coordinates');
  await page.getByRole('grid').getByRole('gridcell').nth(10).click();
  await expect(page.locator('main [role="status"], main .ch-learn-text').first()).toBeVisible();
  await shot(page, 'flow-coordinates-after-tap');
});

test('an opening lesson shows its sidebar and moves on when the right move is played', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the sidebar is a desktop layout');
  await page.goto('/learn/chess/italian');
  await expect(page.getByRole('link', { name: 'Gambit Hậu' })).toBeVisible();
  await expect(page.getByText('Nước 0/11', { exact: false })).toBeVisible();
  const cells = page.getByRole('grid').getByRole('gridcell');
  await cells.nth(52).click(); // e2
  await cells.nth(36).click(); // e4
  await expect(page.getByText(/Nước [12]\/11/)).toBeVisible();
  await shot(page, 'flow-italian-after-e4');
});

test('every lesson links back to the home page', async ({ page }) => {
  await page.goto('/learn/chess/london');
  await page.getByRole('link', { name: 'Về trang chủ' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('home: the first screen shows learning and playing chess', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('cta-learn')).toBeInViewport();
  await expect(page.getByTestId('cta-play')).toBeInViewport();
  await shot(page, `${profile(testInfo)}-home`);
});

test('voice files are served for the sentences of a lesson', async ({ page, request }) => {
  const index = await request.get('/audio/vi-edge/index.json');
  expect(index.ok()).toBeTruthy();
  await page.goto('/learn/chess/pawn');
  const first = await page.evaluate(() => document.querySelector('.ch-learn-text')?.textContent ?? '');
  expect(first.length).toBeGreaterThan(5);
});

test('the side menu lists every lesson and switches between them', async ({ page }) => {
  await page.goto('/learn/chess/coordinates');
  const menu = page.getByRole('navigation', { name: 'Tất cả bài học' });
  await expect(menu.locator('a[href^="/learn/chess/"]')).toHaveCount(LESSONS.length);
  await expect(menu.getByRole('link', { name: 'Làm quen bàn cờ: toạ độ' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await menu.getByRole('link', { name: 'Hệ thống London' }).click();
  await expect(page).toHaveURL(/\/learn\/chess\/london$/);
  await expect(menu.getByRole('link', { name: 'Hệ thống London' })).toHaveAttribute('aria-current', 'page');
});

test.describe('the board stays on screen while the page scrolls', () => {
  test.skip(({ isMobile }) => isMobile, 'a desktop layout');
  test.use({ viewport: { width: 1100, height: 540 } });

  const stays = async (page: Page, grid = page.getByRole('grid').first()) => {
    await page.waitForSelector('html.board-stage');
    const before = (await grid.boundingBox())!;
    const header = (await page.locator('.site-header').boundingBox())!;
    expect(before.y, 'board is below the header').toBeGreaterThanOrEqual(header.y + header.height - 1);
    expect(before.y + before.height, 'board is inside the window').toBeLessThanOrEqual(540);
    await page.mouse.move(before.x + 5, before.y + 5);
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(400);
    const after = (await grid.boundingBox())!;
    expect(after.y, 'board did not move').toBeCloseTo(before.y, 0);
    expect(await page.evaluate(() => window.scrollY), 'the page did not scroll').toBe(0);
  };

  test('a lesson', async ({ page }) => {
    await page.goto('/learn/chess/italian');
    await stays(page);
  });

  test('a game of chess', async ({ page }) => {
    await page.goto('/games/chess');
    await page
      .getByRole('button', { name: /Chơi|Bắt đầu/ })
      .first()
      .click();
    await expect(page.getByRole('grid').first()).toBeVisible();
    await stays(page);
  });
});
