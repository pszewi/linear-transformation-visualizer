import { expect, test, type Page } from '@playwright/test';
import {
  expectNoErrors,
  MINUS,
  openApp,
  panel,
  presetButton,
  renders,
  sub,
  toolbarButton,
  trackErrors,
  waitForRenderIdle,
} from './helpers';

const vectors = (page: Page) => panel(page, 'Vectors');
const coord = (page: Page, n: number, axis: 'x' | 'y' | 'z') =>
  vectors(page).getByRole('spinbutton', { name: `v${sub(n)} ${axis}`, exact: true });
const image = (page: Page, n: number) =>
  vectors(page).getByLabel(new RegExp(`^Image Av${sub(n)} = `));

async function setCoord(page: Page, n: number, axis: 'x' | 'y' | 'z', text: string) {
  await coord(page, n, axis).click();
  const input = vectors(page).getByRole('textbox', { name: `v${sub(n)} ${axis}`, exact: true });
  await input.fill(text);
  await input.press('Enter');
  await expect(coord(page, n, axis)).toBeVisible();
}

/** Run `action` and wait until it caused at least one new WebGL render. */
async function expectRender(page: Page, action: () => Promise<void>) {
  await waitForRenderIdle(page);
  const before = await renders(page);
  await action();
  await expect
    .poll(() => renders(page), { message: 'a render after the change' })
    .toBeGreaterThan(before);
}

test('add, edit, check Av, hide and delete a vector', async ({ page }) => {
  const log = trackErrors(page);
  await openApp(page);
  await presetButton(page, 'Shear x').click(); // A = [[1, 1], [0, 1]]

  await expect(vectors(page)).toContainText('Add a vector');
  await expectRender(page, () => vectors(page).getByRole('button', { name: 'Add vector' }).click());
  await expect(coord(page, 1, 'x')).toHaveAttribute('aria-valuenow', '1');
  await expect(coord(page, 1, 'y')).toHaveAttribute('aria-valuenow', '1');
  await expect(image(page, 1)).toHaveAccessibleName('Image Av₁ = (2, 1)');

  // v = (2, −3): Av = (2 − 3, −3) = (−1, −3).
  await setCoord(page, 1, 'x', '2');
  await setCoord(page, 1, 'y', '-3');
  await expect(image(page, 1)).toHaveAccessibleName(`Image Av₁ = (${MINUS}1, ${MINUS}3)`);

  // Av follows the matrix.
  await presetButton(page, 'Rotate 90°').click(); // (x, y) → (−y, x)
  await expect(image(page, 1)).toHaveAccessibleName('Image Av₁ = (3, 2)');

  // Second vector gets the next label.
  await vectors(page).getByRole('button', { name: 'Add vector' }).click();
  await expect(coord(page, 2, 'x')).toBeVisible();
  await expect(image(page, 2)).toHaveAccessibleName(`Image Av₂ = (${MINUS}1, 1)`);

  // Visibility toggle.
  await expectRender(page, () => vectors(page).getByRole('button', { name: 'Hide v₁' }).click());
  const show = vectors(page).getByRole('button', { name: 'Show v₁' });
  await expect(show).toBeVisible();
  await expectRender(page, () => show.click());
  await expect(vectors(page).getByRole('button', { name: 'Hide v₁' })).toBeVisible();

  // Delete, then undo the delete.
  await expectRender(page, () => vectors(page).getByRole('button', { name: 'Delete v₁' }).click());
  await expect(coord(page, 1, 'x')).toHaveCount(0);
  await expect(coord(page, 2, 'x')).toBeVisible();
  await toolbarButton(page, 'Undo').click();
  await expect(coord(page, 1, 'x')).toHaveAttribute('aria-valuenow', '2');

  await vectors(page).getByRole('button', { name: 'Delete v₁' }).click();
  await vectors(page).getByRole('button', { name: 'Delete v₂' }).click();
  await expect(vectors(page)).toContainText('Add a vector');
  await waitForRenderIdle(page);
  expectNoErrors(log);
});

test('3D vectors have three coordinates and a 3D image', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('3');
  await presetButton(page, 'Cyclic permute').click(); // (x, y, z) → (z, x, y)
  await vectors(page).getByRole('button', { name: 'Add vector' }).click();
  await setCoord(page, 1, 'x', '1');
  await setCoord(page, 1, 'y', '2');
  await setCoord(page, 1, 'z', '3');
  await expect(image(page, 1)).toHaveAccessibleName('Image Av₁ = (3, 1, 2)');
});

test('changing a vector colour updates the swatch selection', async ({ page }) => {
  await openApp(page);
  await vectors(page).getByRole('button', { name: 'Add vector' }).click();
  const swatches = vectors(page).getByRole('group', { name: 'v₁ colour' }).getByRole('button');
  const count = await swatches.count();
  expect(count).toBeGreaterThan(1);
  const target = swatches.nth(count - 1);
  await expect(target).toHaveAttribute('aria-pressed', 'false');
  await expectRender(page, () => target.click());
  await expect(target).toHaveAttribute('aria-pressed', 'true');
  await expect(swatches.and(page.locator('[aria-pressed="true"]'))).toHaveCount(1);
});

for (const dim of [2, 3] as const) {
  test(`toggling every layer in ${dim}D renders and does not throw`, async ({ page }) => {
    const log = trackErrors(page);
    await openApp(page);
    if (dim === 3) await page.keyboard.press('3');
    // Give the objects layer something to draw.
    await vectors(page).getByRole('button', { name: 'Add vector' }).click();

    const layers = panel(page, 'Layers');
    await layers.getByRole('button', { name: 'Layers', exact: true }).click();
    const switches = layers.getByRole('switch');
    await expect(switches).toHaveCount(6);
    for (const toggle of await switches.all()) {
      const name = await toggle.getAttribute('aria-label');
      await expect(toggle, `${name} starts visible`).toHaveAttribute('aria-checked', 'true');
      await expectRender(page, () => toggle.click());
      await expect(toggle).toHaveAttribute('aria-checked', 'false');
    }

    // Edit the matrix while layers are hidden, then show them again: they must refresh.
    await presetButton(page, dim === 2 ? 'Shear x' : 'Shear xy').click();
    await waitForRenderIdle(page);
    for (const toggle of await switches.all()) {
      await expectRender(page, () => toggle.click());
      await expect(toggle).toHaveAttribute('aria-checked', 'true');
    }
    // Clicking the row label toggles too (the switch sits inside a <label>).
    await expectRender(page, () => layers.getByText('Grid', { exact: true }).click());
    await expect(layers.getByRole('switch', { name: 'Grid' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await waitForRenderIdle(page);
    expectNoErrors(log);
  });
}
