import { expect, test, type Page } from '@playwright/test';
import {
  analysisTile,
  expectDim,
  expectMatrix,
  expectNoErrors,
  openApp,
  panel,
  presetButton,
  sub,
  toasts,
  toolbarButton,
  trackErrors,
  typeIntoCell,
  waitForEngine,
} from './helpers';

const vectors = (page: Page) => panel(page, 'Vectors');
const coord = (page: Page, n: number, axis: 'x' | 'y' | 'z') =>
  vectors(page).getByRole('spinbutton', { name: `v${sub(n)} ${axis}`, exact: true });

async function setCoord(page: Page, n: number, axis: 'x' | 'y' | 'z', text: string) {
  await coord(page, n, axis).click();
  const input = vectors(page).getByRole('textbox', { name: `v${sub(n)} ${axis}`, exact: true });
  await input.fill(text);
  await input.press('Enter');
  await expect(coord(page, n, axis)).toBeVisible();
}

/** Base64url of arbitrary text, as the share-link format uses. */
const b64url = (s: string) =>
  Buffer.from(s, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const storedScene = (page: Page) => page.evaluate(() => localStorage.getItem('ltv.scene'));

test('share link restores the matrix and vectors in a fresh browser context', async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
  await openApp(page);
  await page.keyboard.press('3');
  await expectDim(page, 3);
  await presetButton(page, 'Defective').click();
  await typeIntoCell(page, 3, 1, '-1/8');
  await vectors(page).getByRole('button', { name: 'Add vector' }).click();
  await setCoord(page, 1, 'z', '-2.5');
  await vectors(page).getByRole('button', { name: 'Add vector' }).click();
  await vectors(page).getByRole('button', { name: 'Hide v₂' }).click();

  await toolbarButton(page, 'Share').click();
  await expect(toasts(page)).toContainText('Share link copied to clipboard');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/^http:\/\/localhost:4173\/\?debug#s=[A-Za-z0-9_-]+$/);

  const fresh = await browser.newContext();
  try {
    const other = await fresh.newPage();
    const log = trackErrors(other);
    await other.goto(link);
    await waitForEngine(other);
    await expect(toasts(other)).toContainText('Loaded shared scene');
    await expectDim(other, 3);
    await expectMatrix(other, [
      [2, 1, 0],
      [0, 2, 0],
      [-0.125, 0, 2],
    ]);
    await expect(coord(other, 1, 'x')).toHaveAttribute('aria-valuenow', '1');
    await expect(coord(other, 1, 'z')).toHaveAttribute('aria-valuenow', '-2.5');
    await expect(vectors(other).getByRole('button', { name: 'Show v₂' })).toBeVisible();
    // The share hash is dropped once loaded so a reload restores the autosave instead.
    await expect.poll(() => other.evaluate(() => location.hash)).toBe('');
    expectNoErrors(log);
  } finally {
    await fresh.close();
  }
});

test('share without clipboard permission reports an error toast', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) },
      configurable: true,
    });
  });
  await toolbarButton(page, 'Share').click();
  await expect(toasts(page)).toContainText('Could not access the clipboard');
});

test('autosave survives a reload (after the debounce)', async ({ page }) => {
  await openApp(page);
  await presetButton(page, 'Spiral').click();
  await vectors(page).getByRole('button', { name: 'Add vector' }).click();
  await expect.poll(() => storedScene(page)).toContain('"kind":"vector"');
  await page.reload();
  await waitForEngine(page);
  await expectMatrix(page, [
    [1, -1],
    [1, 1],
  ]);
  await expect(coord(page, 1, 'x')).toBeVisible();
  await expect(analysisTile(page, 'det')).toHaveText('2');
});

test('autosave flushes on pagehide when reloading immediately', async ({ page }) => {
  await openApp(page);
  await typeIntoCell(page, 2, 2, '7');
  // Reload right away, inside the 400 ms debounce window: the pagehide flush must save it.
  await page.reload();
  await waitForEngine(page);
  await expect(panel(page, 'Matrix').getByRole('spinbutton').nth(3)).toHaveAttribute(
    'aria-valuenow',
    '7',
  );
});

test('3D scene survives a reload', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('3');
  await presetButton(page, 'Rank 1').click();
  await expect.poll(() => storedScene(page)).toContain('[1,2,3],[2,4,6],[3,6,9]');
  await page.reload();
  await waitForEngine(page);
  await expectDim(page, 3);
  await expectMatrix(page, [
    [1, 2, 3],
    [2, 4, 6],
    [3, 6, 9],
  ]);
});

for (const [what, token] of [
  ['not base64', '%%%not-base64!!'],
  ['base64 of non-JSON', b64url('hello world')],
  ['valid JSON, invalid document', b64url('{"version":1,"transforms":[]}')],
  ['an empty token', ''],
]) {
  test(`malformed share link (${what}) shows an error and falls back`, async ({ page }) => {
    const log = trackErrors(page);
    await openApp(page, `#s=${token}`);
    await expect(toasts(page)).toContainText('That share link is invalid');
    await expectDim(page, 2);
    await expectMatrix(page, [
      [1, 0],
      [0, 1],
    ]);
    expectNoErrors(log);
  });
}

test('malformed share link falls back to the autosaved scene', async ({ page }) => {
  await openApp(page);
  await presetButton(page, 'Reflect x-axis').click();
  await expect.poll(() => storedScene(page)).toContain('[0,-1]');
  // Leave the page first: a same-document hash change would go through 'hashchange' instead.
  await page.goto('about:blank');
  await page.goto('/?debug#s=garbage');
  await waitForEngine(page);
  await expect(toasts(page)).toContainText('That share link is invalid');
  await expectMatrix(page, [
    [1, 0],
    [0, -1],
  ]);
});

test('pasting a share link into the running app loads it (hashchange)', async ({ page }) => {
  await openApp(page);
  const doc = {
    version: 1,
    transforms: [{ id: 't1', label: 'A', rows: [[3, 0], [0, 0.5]] }], // prettier-ignore
    objects: [{ id: 'v1', kind: 'vector', visible: true, coords: [1, 2], label: 'v₁' }],
    view: { layers: {}, interpolation: 'linear' },
  };
  await page.evaluate((hash) => (location.hash = hash), `#s=${b64url(JSON.stringify(doc))}`);
  await expect(toasts(page)).toContainText('Loaded shared scene');
  await expectMatrix(page, [
    [3, 0],
    [0, 0.5],
  ]);
  await expect(coord(page, 1, 'y')).toHaveAttribute('aria-valuenow', '2');
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('');
  // Loading a link is undoable.
  await toolbarButton(page, 'Undo').click();
  await expectMatrix(page, [
    [1, 0],
    [0, 1],
  ]);

  await page.evaluate(() => (location.hash = '#s=broken'));
  await expect(toasts(page)).toContainText('That share link is invalid');
});

test('a scene opened from a share link survives a reload', async ({ browser, baseURL }) => {
  const doc = {
    version: 1,
    transforms: [{ id: 't1', label: 'A', rows: [[1, -1], [1, 1]] }], // prettier-ignore
    objects: [],
    view: { layers: {}, interpolation: 'linear' },
  };
  const context = await browser.newContext({ baseURL });
  try {
    const page = await context.newPage();
    await openApp(page, `#s=${b64url(JSON.stringify(doc))}`);
    await expectMatrix(page, doc.transforms[0].rows);
    await page.reload();
    await waitForEngine(page);
    await expectMatrix(page, doc.transforms[0].rows);
  } finally {
    await context.close();
  }
});
