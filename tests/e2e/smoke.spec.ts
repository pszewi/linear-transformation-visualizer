import { expect, test } from '@playwright/test';
import {
  dimRadio,
  expectDim,
  expectNoErrors,
  inspector,
  openApp,
  panel,
  renders,
  toolbarButton,
  trackErrors,
  waitForRenderIdle,
} from './helpers';

test('loads without page or console errors', async ({ page }) => {
  const log = trackErrors(page);
  await openApp(page);
  await waitForRenderIdle(page);
  expectNoErrors(log);
});

test('shows the canvas, the 2D toolbar and the inspector', async ({ page }) => {
  await openApp(page);
  const canvas = page.getByRole('main', { name: 'Transformation view' }).locator('canvas');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width).toBe(1440);
  expect(box?.height).toBe(900);

  await expect(page.getByRole('banner')).toBeVisible();
  await expectDim(page, 2);
  for (const name of ['Undo', 'Redo', 'Reset camera', 'Keyboard shortcuts', 'Share']) {
    await expect(toolbarButton(page, name)).toBeVisible();
  }
  await expect(toolbarButton(page, 'Undo')).toBeDisabled();

  await expect(inspector(page)).toBeVisible();
  for (const name of ['Matrix', 'Presets', 'Analysis', 'Vectors', 'Layers', 'Settings']) {
    await expect(panel(page, name)).toBeVisible();
  }
});

test('switches 2D ↔ 3D with the segmented control', async ({ page }) => {
  const log = trackErrors(page);
  await openApp(page);
  await dimRadio(page, 3).click();
  await expectDim(page, 3);
  await expect(panel(page, 'Presets').getByRole('button', { name: 'Rotate z 90°' })).toBeVisible();
  await dimRadio(page, 2).click();
  await expectDim(page, 2);
  await expect(panel(page, 'Presets').getByRole('button', { name: 'Rotate 90°' })).toBeVisible();
  await waitForRenderIdle(page);
  expectNoErrors(log);
});

test('switches 2D ↔ 3D with the 3 and 2 keys', async ({ page }) => {
  const log = trackErrors(page);
  await openApp(page);
  await page.keyboard.press('3');
  await expectDim(page, 3);
  await page.keyboard.press('2');
  await expectDim(page, 2);
  // Arrow keys on the focused radio group also switch.
  await dimRadio(page, 2).focus();
  await page.keyboard.press('ArrowRight');
  await expectDim(page, 3);
  await expect(dimRadio(page, 3)).toBeFocused();
  await waitForRenderIdle(page);
  expectNoErrors(log);
});

test('shortcuts dialog opens with ? and closes with Escape', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('?');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // App shortcuts are suspended while the dialog is open.
  await page.keyboard.press('3');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expectDim(page, 2);
});

test('dragging the 2D view pans it; R and the toolbar button reset the camera', async ({
  page,
}) => {
  const log = trackErrors(page);
  await openApp(page);
  await waitForRenderIdle(page);
  const origin = () =>
    page.evaluate(() => {
      const r = document.querySelector('.ltv-tick-corner')?.getBoundingClientRect();
      return r ? { x: Math.round(r.right), y: Math.round(r.top) } : null;
    });
  const home = await origin();
  expect(home).not.toBeNull();

  const pan = async () => {
    await page.mouse.move(400, 500);
    await page.mouse.down();
    await page.mouse.move(450, 470, { steps: 5 });
    await page.mouse.up();
    await expect.poll(origin).not.toEqual(home);
  };
  await pan();
  await page.keyboard.press('r');
  await expect.poll(origin).toEqual(home);

  await pan();
  await toolbarButton(page, 'Reset camera').click();
  await expect.poll(origin).toEqual(home);
  await waitForRenderIdle(page);
  expectNoErrors(log);
});

test('3D view orbits on drag and settles (no endless render loop)', async ({ page }) => {
  const log = trackErrors(page);
  await openApp(page);
  await page.keyboard.press('3');
  await expectDim(page, 3);
  await waitForRenderIdle(page);
  const before = await renders(page);
  await page.mouse.move(400, 500);
  await page.mouse.down();
  await page.mouse.move(520, 440, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => renders(page)).toBeGreaterThan(before);
  // OrbitControls damping keeps rendering for a moment, then the loop must go idle.
  await waitForRenderIdle(page);
  await page.keyboard.press('r');
  await waitForRenderIdle(page);
  expectNoErrors(log);
});

test('the sidebar collapses to a rail and a rail button reveals its panel', async ({ page }) => {
  await openApp(page);
  // Close the Analysis panel first so revealing it has something to do.
  await panel(page, 'Analysis').getByRole('button', { name: 'Analysis', exact: true }).click();
  await expect(
    panel(page, 'Analysis').getByRole('button', { name: 'Analysis', exact: true }),
  ).toHaveAttribute('aria-expanded', 'false');

  await inspector(page).getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(panel(page, 'Matrix')).toHaveCount(0);
  await inspector(page).getByRole('button', { name: 'Analysis', exact: true }).click();
  const toggle = panel(page, 'Analysis').getByRole('button', { name: 'Analysis', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toBeFocused();
  await expect(inspector(page).getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();

  // The collapsed state is a per-viewer preference that survives a reload.
  await inspector(page).getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(inspector(page).getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('ltv.ui')))
    .toContain('"sidebarCollapsed":true');
  await page.reload();
  await expect(inspector(page).getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
});
