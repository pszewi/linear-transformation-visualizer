/**
 * Shared helpers for the end-to-end suite. The app is opened with `?debug`, which installs
 * `window.__LTV_DEBUG__` (render counter, frame time, GPU resource counts; see src/engine/debug.ts).
 */
import { expect, type Locator, type Page } from '@playwright/test';
import type { LtvDebugInfo } from '../../src/engine/debug';

const SUB = '₀₁₂₃₄₅₆₇₈₉';
export const sub = (n: number | string) => String(n).replace(/\d/g, (d) => SUB[Number(d)]);

/** Plain-text minus used by the UI (core/format.ts). */
export const MINUS = '−';

/** Console messages that are expected from headless Chromium + SwiftShader, not from the app. */
const BENIGN_CONSOLE = [
  /software WebGL has been deprecated/i,
  /enable-unsafe-swiftshader/i,
  /GL Driver Message/i,
  /GPU stall due to ReadPixels/i,
];

export interface ErrorLog {
  readonly pageErrors: string[];
  readonly consoleErrors: string[];
  readonly consoleWarnings: string[];
}

/** Start recording uncaught page errors and console errors/warnings (call before `goto`). */
export function trackErrors(page: Page): ErrorLog {
  const log: ErrorLog = { pageErrors: [], consoleErrors: [], consoleWarnings: [] };
  page.on('pageerror', (e) => log.pageErrors.push(`${e.name}: ${e.message}`));
  page.on('console', (m) => {
    const text = m.text();
    if (BENIGN_CONSOLE.some((re) => re.test(text))) return;
    if (m.type() === 'error') log.consoleErrors.push(text);
    else if (m.type() === 'warning') log.consoleWarnings.push(text);
  });
  return log;
}

export function expectNoErrors(log: ErrorLog): void {
  expect(log.pageErrors, 'uncaught page errors').toEqual([]);
  expect(log.consoleErrors, 'console errors').toEqual([]);
}

/** Open the app with the debug hook and wait until the engine has rendered at least once. */
export async function openApp(page: Page, hash = ''): Promise<void> {
  await page.goto(`/?debug${hash}`);
  await waitForEngine(page);
}

export async function waitForEngine(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__LTV_DEBUG__?.renders ?? 0), {
      message: 'engine renders at least once',
    })
    .toBeGreaterThan(0);
}

export function renders(page: Page): Promise<number> {
  return page.evaluate(() => window.__LTV_DEBUG__?.renders ?? -1);
}

export function gpuInfo(page: Page): Promise<LtvDebugInfo> {
  return page.evaluate(() => {
    const dbg = window.__LTV_DEBUG__;
    if (!dbg) throw new Error('debug hook missing');
    return dbg.info();
  });
}

/**
 * Resolve once the render loop has been quiet (no new render) for `quietMs`, checked every
 * animation frame. This is a condition wait, not a sleep: it returns as soon as rendering stops.
 */
export async function waitForRenderIdle(page: Page, quietMs = 300): Promise<void> {
  await page.evaluate(
    (quiet) =>
      new Promise<void>((resolve, reject) => {
        const dbg = window.__LTV_DEBUG__;
        if (!dbg) {
          reject(new Error('debug hook missing'));
          return;
        }
        let last = dbg.renders;
        let since = performance.now();
        const deadline = since + 15_000;
        const check = (now: number) => {
          if (dbg.renders !== last) {
            last = dbg.renders;
            since = now;
          }
          if (now - since >= quiet) resolve();
          else if (now > deadline) reject(new Error('render loop never went idle'));
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }),
    quietMs,
  );
}

// ── locators ────────────────────────────────────────────────────────────────

export const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspector' });
export const panel = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

function cellLabel(i: number, j: number): string {
  return `a${sub(`${i}${j}`)}, row ${i}, column ${j}`;
}

/** Matrix cell (1-based) in display mode. */
export const cell = (page: Page, i: number, j: number) =>
  panel(page, 'Matrix').getByRole('spinbutton', { name: cellLabel(i, j), exact: true });

/** Matrix cell (1-based) while it is being typed into. */
export const cellInput = (page: Page, i: number, j: number) =>
  panel(page, 'Matrix').getByRole('textbox', { name: cellLabel(i, j), exact: true });

/** Entry slider (1-based); the "Entry sliders" disclosure must be open. */
export const entrySlider = (page: Page, i: number, j: number) =>
  panel(page, 'Matrix').getByRole('slider', { name: cellLabel(i, j), exact: true });

/** Assert the matrix cells show these values (aria-valuenow, i.e. the exact stored number). */
export async function expectMatrix(page: Page, rows: number[][]): Promise<void> {
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < rows[i].length; j++) {
      await expect(cell(page, i + 1, j + 1)).toHaveAttribute('aria-valuenow', String(rows[i][j]));
    }
  }
}

/** Numeric value currently stored in a matrix cell. */
export async function cellValue(page: Page, i: number, j: number): Promise<number> {
  return Number(await cell(page, i, j).getAttribute('aria-valuenow'));
}

/** The det / trace tile value as displayed (3 decimals, U+2212 minus). */
export const analysisTile = (page: Page, label: 'det' | 'tr') =>
  panel(page, 'Analysis')
    .locator('.tile')
    .filter({ has: page.locator('.tile-label', { hasText: new RegExp(`^${label}\\b`) }) })
    .locator('.tile-value');

/** A rank/nullity fact value. */
export const analysisFact = (page: Page, label: 'Rank' | 'Nullity') =>
  panel(page, 'Analysis')
    .locator('.fact')
    .filter({ has: page.locator('.fact-label', { hasText: label }) })
    .locator('.fact-value');

/** Group (Eigenvalues, Eigenspaces, Kernel & image) inside the Analysis panel. */
export const analysisGroup = (page: Page, title: string) =>
  panel(page, 'Analysis')
    .locator('.group')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });

/** TeX source of every math element in `scope` (KaTeX keeps it in an <annotation>). */
export async function texOf(scope: Locator): Promise<string[]> {
  return scope.locator('annotation[encoding="application/x-tex"]').allTextContents();
}

/** Eigenvalue chips as { tex: value part after "=", multiplicity }. */
export async function eigenvalues(page: Page): Promise<{ value: string; mult: number }[]> {
  const chips = analysisGroup(page, 'Eigenvalues').getByRole('listitem');
  const out: { value: string; mult: number }[] = [];
  for (const chip of await chips.all()) {
    const [tex] = await texOf(chip);
    const value = tex.split('=')[1]?.trim() ?? '';
    const multEl = chip.locator('.mult');
    const mult = (await multEl.count()) > 0 ? Number((await multEl.innerText()).slice(1)) : 1;
    out.push({ value, mult });
  }
  return out;
}

export const presetButton = (page: Page, name: string) =>
  panel(page, 'Presets').getByRole('button', { name, exact: true });

export const toolbarButton = (page: Page, name: string) =>
  page.getByRole('banner').getByRole('button', { name, exact: true });

export const dimRadio = (page: Page, dim: 2 | 3) =>
  page
    .getByRole('radiogroup', { name: 'Dimension' })
    .getByRole('radio', { name: new RegExp(`^${dim}D`) });

export async function expectDim(page: Page, dim: 2 | 3): Promise<void> {
  await expect(dimRadio(page, dim)).toHaveAttribute('aria-checked', 'true');
  await expect(panel(page, 'Matrix').getByRole('group')).toHaveAccessibleName(
    `Matrix A, ${dim} by ${dim}`,
  );
}

/** Type a value into a matrix cell via click → type → Enter. */
export async function typeIntoCell(page: Page, i: number, j: number, text: string): Promise<void> {
  await cell(page, i, j).click();
  const input = cellInput(page, i, j);
  await expect(input).toBeFocused();
  await input.fill(text);
  await input.press('Enter');
  await expect(cell(page, i, j)).toBeVisible();
}

/** Toast region (role=status). */
export const toasts = (page: Page) => page.getByRole('status');
