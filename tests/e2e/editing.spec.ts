import { expect, test, type Page } from '@playwright/test';
import {
  analysisFact,
  analysisGroup,
  analysisTile,
  cell,
  cellInput,
  cellValue,
  eigenvalues,
  entrySlider,
  expectDim,
  expectMatrix,
  expectNoErrors,
  MINUS,
  openApp,
  panel,
  presetButton,
  toolbarButton,
  trackErrors,
  typeIntoCell,
} from './helpers';

const sorted = (xs: string[]) => [...xs].sort();

async function eigenvalueSet(page: Page): Promise<string[]> {
  return sorted((await eigenvalues(page)).map((e) => e.value));
}

test.describe('matrix cells', () => {
  test('typed values (fractions, decimals) update det and trace', async ({ page }) => {
    const log = trackErrors(page);
    await openApp(page);
    await expect(analysisTile(page, 'det')).toHaveText('1');
    await expect(analysisTile(page, 'tr')).toHaveText('2');

    // A = [[−3/4, 0], [0, 1]]: det = −0.75, tr = 0.25.
    await typeIntoCell(page, 1, 1, '-3/4');
    await expect(cell(page, 1, 1)).toHaveAttribute('aria-valuenow', '-0.75');
    await expect(cell(page, 1, 1)).toHaveText(`${MINUS}0.75`);
    await expect(analysisTile(page, 'det')).toHaveText(`${MINUS}0.75`);
    await expect(analysisTile(page, 'tr')).toHaveText('0.25');
    await expect(panel(page, 'Analysis')).toContainText('Orientation reversed');

    // A = [[−0.75, 1/3], [2, 1]]: det = −0.75 − 2/3 = −1.41666…, tr = 0.25.
    await typeIntoCell(page, 1, 2, '1/3');
    await typeIntoCell(page, 2, 1, '2');
    await expect(analysisTile(page, 'det')).toHaveText(`${MINUS}1.417`);
    await expect(analysisTile(page, 'tr')).toHaveText('0.25');
    // The engine keeps rendering the committed values without errors.
    expectNoErrors(log);
  });

  test('typing a digit on a focused cell starts an edit with that digit', async ({ page }) => {
    await openApp(page);
    await cell(page, 2, 2).focus();
    await page.keyboard.type('4.5');
    await page.keyboard.press('Enter');
    await expect(cell(page, 2, 2)).toHaveAttribute('aria-valuenow', '4.5');
    await expect(cell(page, 2, 2)).toBeFocused();
    await expect(analysisTile(page, 'det')).toHaveText('4.5');
    // The digit went to the cell, not to the "2"/"3" dimension shortcuts.
    await expectDim(page, 2);
  });

  test('invalid input keeps the editor open and marks it invalid', async ({ page }) => {
    await openApp(page);
    await cell(page, 1, 1).click();
    const input = cellInput(page, 1, 1);
    await input.fill('abc');
    await input.press('Enter');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await input.fill('7');
    await input.press('Enter');
    await expect(cell(page, 1, 1)).toHaveAttribute('aria-valuenow', '7');
  });

  test('Escape cancels an edit', async ({ page }) => {
    await openApp(page);
    await cell(page, 1, 2).click();
    const input = cellInput(page, 1, 2);
    await input.fill('9');
    await input.press('Escape');
    await expect(input).toBeHidden();
    await expect(cell(page, 1, 2)).toHaveAttribute('aria-valuenow', '0');
    await expect(cell(page, 1, 2)).toBeFocused();
    await expect(toolbarButton(page, 'Undo')).toBeDisabled();
  });

  test('arrow keys step a cell (0.1, Shift for 1, PageUp/PageDown for 1)', async ({ page }) => {
    await openApp(page);
    const a11 = cell(page, 1, 1);
    await a11.focus();
    await page.keyboard.press('ArrowUp');
    await expect(a11).toHaveAttribute('aria-valuenow', '1.1');
    await page.keyboard.press('Shift+ArrowUp');
    await expect(a11).toHaveAttribute('aria-valuenow', '2.1');
    await page.keyboard.press('ArrowDown');
    await expect(a11).toHaveAttribute('aria-valuenow', '2');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('ArrowLeft');
    await expect(a11).toHaveAttribute('aria-valuenow', '0.9');
    await expect(analysisTile(page, 'tr')).toHaveText('1.9');
  });

  test('scrubbing by drag changes the value continuously and is one undo step', async ({
    page,
  }) => {
    await openApp(page);
    const a11 = cell(page, 1, 1);
    const box = await a11.boundingBox();
    if (!box) throw new Error('cell has no box');
    const x0 = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x0, y);
    await page.mouse.down();
    // First move past the 3 px threshold only arms the scrub; then 0.02 per pixel.
    await page.mouse.move(x0 + 5, y);
    await expect(a11).toHaveAttribute('aria-valuenow', '1');
    await page.mouse.move(x0 + 30, y);
    await expect(a11).toHaveAttribute('aria-valuenow', '1.5');
    await expect(analysisTile(page, 'det')).toHaveText('1.5');
    await page.mouse.move(x0 + 55, y);
    await expect(a11).toHaveAttribute('aria-valuenow', '2');
    await page.mouse.move(x0 + 105, y);
    await expect(a11).toHaveAttribute('aria-valuenow', '3');
    await expect(analysisTile(page, 'det')).toHaveText('3');
    await page.mouse.up();

    // Releasing a scrub must not open the text editor.
    await expect(cellInput(page, 1, 1)).toBeHidden();
    await expect(a11).toHaveAttribute('aria-valuenow', '3');

    const undo = toolbarButton(page, 'Undo');
    await expect(undo).toBeEnabled();
    await undo.click();
    await expect(a11).toHaveAttribute('aria-valuenow', '1');
    await expect(analysisTile(page, 'det')).toHaveText('1');
    // Exactly one history entry for the whole gesture.
    await expect(undo).toBeDisabled();
    await toolbarButton(page, 'Redo').click();
    await expect(a11).toHaveAttribute('aria-valuenow', '3');
  });

  test('a click without drag opens the editor with the value selected', async ({ page }) => {
    await openApp(page);
    await cell(page, 2, 1).click();
    const input = cellInput(page, 2, 1);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('0');
    await page.keyboard.type('5');
    await page.keyboard.press('Enter');
    await expect(cell(page, 2, 1)).toHaveAttribute('aria-valuenow', '5');
  });
});

test('entry sliders change the matrix (one undo step per gesture)', async ({ page }) => {
  await openApp(page);
  const toggle = panel(page, 'Matrix').getByRole('button', { name: 'Entry sliders' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  const s11 = entrySlider(page, 1, 1);
  await expect(s11).toBeVisible();
  await expect(s11).toHaveValue('1');
  await s11.fill('3');
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-valuenow', '3');
  await expect(analysisTile(page, 'det')).toHaveText('3');
  await expect(analysisTile(page, 'tr')).toHaveText('4');

  await entrySlider(page, 2, 1).focus();
  await page.keyboard.press('ArrowRight');
  await expect(cell(page, 2, 1)).toHaveAttribute('aria-valuenow', '0.01');

  // Typing in a cell moves the slider too.
  await typeIntoCell(page, 1, 2, '-2');
  await expect(entrySlider(page, 1, 2)).toHaveValue('-2');

  const undo = toolbarButton(page, 'Undo');
  await undo.click();
  await expect(cell(page, 1, 2)).toHaveAttribute('aria-valuenow', '0');
  await undo.click();
  await expect(cell(page, 2, 1)).toHaveAttribute('aria-valuenow', '0');
  await undo.click();
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-valuenow', '1');
  await expect(undo).toBeDisabled();
});

test.describe('presets (2D)', () => {
  test('Rotate 90°: det 1, trace 0, eigenvalues ±i', async ({ page }) => {
    await openApp(page);
    await presetButton(page, 'Rotate 90°').click();
    await expect(presetButton(page, 'Rotate 90°')).toHaveAttribute('aria-pressed', 'true');
    await expectMatrix(page, [
      [0, -1],
      [1, 0],
    ]);
    await expect(analysisTile(page, 'det')).toHaveText('1');
    await expect(analysisTile(page, 'tr')).toHaveText('0');
    expect(await eigenvalueSet(page)).toEqual(sorted(['i', '-i']));
    await expect(panel(page, 'Analysis')).toContainText('Complex eigenvalues come in conjugate');
    // No real eigenspace.
    await expect(analysisGroup(page, 'Eigenspaces')).toHaveCount(0);
  });

  test('Singular rank 1: rank 1, nullity 1, eigenvalues 5 and 0', async ({ page }) => {
    await openApp(page);
    await presetButton(page, 'Singular rank 1').click();
    await expectMatrix(page, [
      [1, 2],
      [2, 4],
    ]);
    await expect(analysisFact(page, 'Rank')).toHaveText('1');
    await expect(analysisFact(page, 'Nullity')).toHaveText('1');
    await expect(analysisTile(page, 'det')).toHaveText('0');
    await expect(analysisTile(page, 'tr')).toHaveText('5');
    await expect(panel(page, 'Analysis')).toContainText('Singular');
    await expect(panel(page, 'Analysis')).toContainText('Space collapsed');
    expect(await eigenvalueSet(page)).toEqual(sorted(['5', '0']));
  });

  test('Shear x is marked defective', async ({ page }) => {
    await openApp(page);
    await presetButton(page, 'Shear x').click();
    await expectMatrix(page, [
      [1, 1],
      [0, 1],
    ]);
    const group = analysisGroup(page, 'Eigenvalues');
    await expect(group.getByText('Defective', { exact: true })).toBeVisible();
    expect(await eigenvalues(page)).toEqual([{ value: '1', mult: 2 }]);
    await expect(analysisGroup(page, 'Eigenspaces').locator('.dims')).toHaveText(/dim\s*1\s*of 2/);
  });

  test('identity is not defective and has a 2-dimensional eigenspace', async ({ page }) => {
    await openApp(page);
    await expect(
      analysisGroup(page, 'Eigenvalues').getByText('Defective', { exact: true }),
    ).toHaveCount(0);
    await expect(analysisGroup(page, 'Eigenspaces').locator('.dims')).toHaveText(/dim\s*2\s*of 2/);
  });
});

test('undo/redo via toolbar buttons and keyboard', async ({ page }) => {
  await openApp(page);
  const undo = toolbarButton(page, 'Undo');
  const redo = toolbarButton(page, 'Redo');
  const I = [
    [1, 0],
    [0, 1],
  ];
  const S = [
    [2, 0],
    [0, 2],
  ];
  const R = [
    [0, -1],
    [1, 0],
  ];
  await presetButton(page, 'Scale ×2').click();
  await expectMatrix(page, S);
  await presetButton(page, 'Rotate 90°').click();
  await expectMatrix(page, R);

  await undo.click();
  await expectMatrix(page, S);
  await expect(analysisTile(page, 'det')).toHaveText('4');
  await undo.click();
  await expectMatrix(page, I);
  await expect(undo).toBeDisabled();
  await redo.click();
  await expectMatrix(page, S);

  // Keyboard (focus on the page body, not in a text field).
  await page.locator('body').click({ position: { x: 300, y: 600 } });
  await page.keyboard.press('ControlOrMeta+Shift+Z');
  await expectMatrix(page, R);
  await expect(redo).toBeDisabled();
  await page.keyboard.press('ControlOrMeta+Z');
  await expectMatrix(page, S);
  await page.keyboard.press('ControlOrMeta+Y');
  await expectMatrix(page, R);

  // A new edit clears the redo stack.
  await page.keyboard.press('ControlOrMeta+Z');
  await typeIntoCell(page, 1, 1, '3');
  await expect(redo).toBeDisabled();
  // Ctrl+Z with focus on a matrix cell undoes the edit.
  await cell(page, 1, 1).focus();
  await page.keyboard.press('ControlOrMeta+Z');
  await expectMatrix(page, S);
});

test('undo restores the 2D scene after switching to 3D', async ({ page }) => {
  await openApp(page);
  await presetButton(page, 'Shear x').click();
  await page.keyboard.press('3');
  await expectDim(page, 3);
  await toolbarButton(page, 'Undo').click();
  await expectDim(page, 2);
  await expectMatrix(page, [
    [1, 1],
    [0, 1],
  ]);
  await toolbarButton(page, 'Redo').click();
  await expectDim(page, 3);
});

test.describe('presets (3D)', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('3');
    await expectDim(page, 3);
  });

  test('Defective: λ = 2 with multiplicity 3 and a 2-dimensional eigenspace', async ({ page }) => {
    await presetButton(page, 'Defective').click();
    await expectMatrix(page, [
      [2, 1, 0],
      [0, 2, 0],
      [0, 0, 2],
    ]);
    expect(await eigenvalues(page)).toEqual([{ value: '2', mult: 3 }]);
    await expect(
      analysisGroup(page, 'Eigenvalues').getByText('Defective', { exact: true }),
    ).toBeVisible();
    const space = analysisGroup(page, 'Eigenspaces').getByRole('listitem');
    await expect(space).toHaveCount(1);
    await expect(space.locator('.dims')).toHaveText(/dim\s*2\s*of 3/);
    await expect(analysisTile(page, 'det')).toHaveText('8');
    await expect(analysisTile(page, 'tr')).toHaveText('6');
  });

  test('Rotate z 90°: eigenvalues 1, ±i', async ({ page }) => {
    await presetButton(page, 'Rotate z 90°').click();
    await expect(analysisTile(page, 'det')).toHaveText('1');
    await expect(analysisTile(page, 'tr')).toHaveText('1');
    expect(await eigenvalueSet(page)).toEqual(sorted(['1', 'i', '-i']));
    expect(await cellValue(page, 3, 3)).toBe(1);
  });

  test('Singular rank 2: rank 2, nullity 1', async ({ page }) => {
    await presetButton(page, 'Singular rank 2').click();
    await expect(analysisFact(page, 'Rank')).toHaveText('2');
    await expect(analysisFact(page, 'Nullity')).toHaveText('1');
    await expect(analysisTile(page, 'det')).toHaveText('0');
  });
});
