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

const storedScene = (page: Page) => page.evaluate(() => localStorage.getItem('ltv.scene'));

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

/** A valid 2D scene document, as written by Save. */
const sceneDoc = (rows: number[][]) => ({
  version: 1,
  transforms: [{ id: 't1', label: 'A', rows }],
  objects: [{ id: 'o1', kind: 'vector', visible: true, colorKey: 'violet', coords: [2, -1] }],
  view: { layers: {}, interpolation: 'linear' },
});

async function openFile(page: Page, name: string, contents: string) {
  const chooser = page.waitForEvent('filechooser');
  await toolbarButton(page, 'Open scene').click();
  await (
    await chooser
  ).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(contents) });
}

test('Save downloads a valid scene file', async ({ page }) => {
  await openApp(page);
  await presetButton(page, 'Shear x').click();
  await expectMatrix(page, [
    [1, 1],
    [0, 1],
  ]);
  const download = page.waitForEvent('download');
  await toolbarButton(page, 'Save').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('scene.ltv');
  const doc = JSON.parse(
    await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8')),
  );
  expect(doc.version).toBe(1);
  expect(doc.transforms[0].rows).toEqual([
    [1, 1],
    [0, 1],
  ]);
  await expect(toasts(page)).toContainText('Saved scene.ltv');
});

test('Open restores the matrix and vectors, and survives a reload', async ({ page }) => {
  const errors = trackErrors(page);
  await openApp(page);
  await openFile(page, 'rotation.ltv', JSON.stringify(sceneDoc([[0, -1], [1, 0]]))); // prettier-ignore
  await expect(toasts(page)).toContainText('Opened rotation.ltv');
  await expectMatrix(page, [
    [0, -1],
    [1, 0],
  ]);
  // The vector came along (the Vectors panel is collapsed by default, so check the autosave).
  await expect.poll(() => storedScene(page)).toContain('"coords":[2,-1]');
  await expect(page).toHaveTitle(/^rotation\.ltv — /);
  await page.reload();
  await waitForEngine(page);
  await expectMatrix(page, [
    [0, -1],
    [1, 0],
  ]);
  expectNoErrors(errors);
});

test('editing after Open marks the scene as unsaved in the title', async ({ page }) => {
  await openApp(page);
  await openFile(page, 'a.ltv', JSON.stringify(sceneDoc([[1, 0], [0, 1]]))); // prettier-ignore
  await expect(page).toHaveTitle(/^a\.ltv — /);
  await presetButton(page, 'Shear x').click();
  await expect(page).toHaveTitle(/^• a\.ltv — /);
});

for (const [what, contents] of [
  ['not JSON', 'hello world'],
  ['JSON, but not a scene', '{"version":1,"transforms":[]}'],
  ['an empty file', ''],
]) {
  test(`opening ${what} shows an error and keeps the current scene`, async ({ page }) => {
    await openApp(page);
    await presetButton(page, 'Shear x').click();
    await openFile(page, 'bad.ltv', contents);
    await expect(toasts(page)).toContainText('bad.ltv is not a valid scene file');
    await expectMatrix(page, [
      [1, 1],
      [0, 1],
    ]);
  });
}
