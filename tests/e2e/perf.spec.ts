/**
 * Performance and resource checks via `window.__LTV_DEBUG__`. SwiftShader is a CPU rasteriser, so
 * absolute frame times are indicative only; the bounds here are deliberately generous.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  cell,
  expectDim,
  gpuInfo,
  inspector,
  openApp,
  panel,
  presetButton,
  renders,
  toolbarButton,
  waitForRenderIdle,
} from './helpers';

/** Renders counted over `ms` of wall time, measured in the page. */
function rendersDuring(page: Page, ms: number): Promise<number> {
  return page.evaluate(
    (window_) =>
      new Promise<number>((resolve) => {
        const start = window.__LTV_DEBUG__?.renders ?? 0;
        setTimeout(() => resolve((window.__LTV_DEBUG__?.renders ?? 0) - start), window_);
      }),
    ms,
  );
}

/** Press-and-hold on a matrix cell; returns helpers to move horizontally and release. */
async function grabCell(page: Page, i: number, j: number) {
  // Mouse APIs do not auto-scroll; earlier clicks lower in the inspector may have scrolled it.
  await cell(page, i, j).scrollIntoViewIfNeeded();
  const box = await cell(page, i, j).boundingBox();
  if (!box) throw new Error('cell has no box');
  const x0 = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  await page.mouse.move(x0 + 5, y); // arm the scrub (3 px threshold)
  return {
    moveTo: (dx: number) => page.mouse.move(x0 + 5 + dx, y),
    release: () => page.mouse.up(),
  };
}

const quantile = (sorted: number[], q: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

test.describe('idle', () => {
  test('no renders while idle after load and after an animation (2D)', async ({ page }) => {
    await openApp(page);
    await waitForRenderIdle(page);
    const afterLoad = await rendersDuring(page, 1500);

    const before = await renders(page);
    await presetButton(page, 'Rotate 90°').click(); // animated commit
    await expect.poll(() => renders(page)).toBeGreaterThan(before + 1);
    await waitForRenderIdle(page);
    const afterAnimation = await rendersDuring(page, 1500);

    test.info().annotations.push({
      type: 'idle renders (2D)',
      description: `after load: ${afterLoad}, after animation: ${afterAnimation}`,
    });
    expect(afterLoad).toBe(0);
    expect(afterAnimation).toBe(0);
  });

  test('no renders while idle in 3D (after camera reset tween)', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('3');
    await expectDim(page, 3);
    await presetButton(page, 'Cyclic permute').click();
    await waitForRenderIdle(page);
    await toolbarButton(page, 'Reset camera').click();
    await waitForRenderIdle(page);
    const idle = await rendersDuring(page, 1500);
    test.info().annotations.push({ type: 'idle renders (3D)', description: String(idle) });
    expect(idle).toBe(0);
  });
});

/**
 * Drive the 2D scene once through everything that lazily creates shared GPU resources (eigen
 * lines, the arrow kit of the objects layer, …), ending back at the identity with no vectors.
 */
async function warmUp(page: Page) {
  const grip = await grabCell(page, 1, 1);
  await grip.moveTo(40); // non-identity → real eigenspace lines appear
  await grip.release();
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-valuenow', '1.8');
  await waitForRenderIdle(page);
  await toolbarButton(page, 'Undo').click();
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-valuenow', '1');
  await panel(page, 'Vectors').getByRole('button', { name: 'Add vector' }).click();
  await waitForRenderIdle(page);
  await panel(page, 'Vectors')
    .getByRole('button', { name: /^Delete / })
    .click();
  await waitForRenderIdle(page);
}

test('GPU resources return to baseline after edits, vectors and 2D↔3D switches', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await openApp(page);
  await waitForRenderIdle(page);
  const cold = await gpuInfo(page);
  // Shared resources are created on first use and kept for the layer's lifetime (bounded). Compare
  // like with like: the same scene state (2D identity, no vectors) after one warm-up pass.
  await warmUp(page);
  const warm = await gpuInfo(page);

  // 300 live edits: scrub a cell back and forth (1.8 ↔ 0.2), then undo the gesture.
  const grip = await grabCell(page, 1, 1);
  for (let k = 0; k < 300; k++) await grip.moveTo(k % 2 === 0 ? 40 : -40);
  await grip.release();
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-valuenow', '0.2');
  await waitForRenderIdle(page);
  const scrubbed = await gpuInfo(page);
  await toolbarButton(page, 'Undo').click();
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-valuenow', '1');
  await waitForRenderIdle(page);
  const afterEdits = await gpuInfo(page);

  // Vectors: add 8, render them, remove them all.
  const addVector = panel(page, 'Vectors').getByRole('button', { name: 'Add vector' });
  for (let k = 0; k < 8; k++) await addVector.click();
  await waitForRenderIdle(page);
  const withVectors = await gpuInfo(page);
  const deletes = panel(page, 'Vectors').getByRole('button', { name: /^Delete / });
  while ((await deletes.count()) > 0) await deletes.first().click();
  await waitForRenderIdle(page);
  const afterVectors = await gpuInfo(page);

  // 10 round trips 2D → 3D → 2D (with a vector in 3D, so the objects layer is exercised).
  // Switching rebuilds the layers, so the 2D scene must come back to the cold-start counts.
  for (let k = 0; k < 10; k++) {
    await page.keyboard.press('3');
    await expectDim(page, 3);
    await addVector.click();
    await waitForRenderIdle(page);
    await page.keyboard.press('2');
    await expectDim(page, 2);
    await waitForRenderIdle(page);
  }
  const afterSwitches = await gpuInfo(page);
  await warmUp(page);
  const rewarmed = await gpuInfo(page);

  const fmt = (i: typeof cold) => `geo ${i.geometries}/tex ${i.textures}/prog ${i.programs}`;
  const report = [
    `cold start: ${fmt(cold)}`,
    `warm: ${fmt(warm)}`,
    `scrubbed matrix: ${fmt(scrubbed)}`,
    `after 300 edits + undo: ${fmt(afterEdits)}`,
    `with 8 vectors: ${fmt(withVectors)}`,
    `after removing vectors: ${fmt(afterVectors)}`,
    `after 10 2D↔3D round trips: ${fmt(afterSwitches)}`,
    `warm again: ${fmt(rewarmed)}`,
  ].join('; ');
  test.info().annotations.push({ type: 'gpu resources', description: report });
  console.log(report);

  const counts = (i: typeof cold) => ({
    geometries: i.geometries,
    textures: i.textures,
    programs: i.programs,
  });
  expect(counts(afterEdits), 'after live edits').toEqual(counts(warm));
  expect(counts(afterVectors), 'after adding/removing vectors').toEqual(counts(warm));
  expect(counts(afterSwitches), 'after 2D↔3D switches').toEqual(counts(cold));
  expect(counts(rewarmed), 'warm-up after switches').toEqual(counts(warm));
});

/** Start recording engine frame time (lastFrameMs) for every new render. */
async function startFrameSampling(page: Page) {
  await page.evaluate(() => {
    const dbg = window.__LTV_DEBUG__;
    if (!dbg) throw new Error('debug hook missing');
    const w = window as unknown as { __samples: number[]; __sampling: boolean };
    w.__samples = [];
    w.__sampling = true;
    let last = dbg.renders;
    const loop = () => {
      if (dbg.renders !== last) {
        last = dbg.renders;
        w.__samples.push(dbg.lastFrameMs);
      }
      if (w.__sampling) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

function stopFrameSampling(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __samples: number[]; __sampling: boolean };
    w.__sampling = false;
    return w.__samples;
  });
}

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const median = quantile(sorted, 0.5);
  const p95 = quantile(sorted, 0.95);
  const max = sorted[sorted.length - 1];
  const text = `n=${samples.length}, median ${median.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms, max ${max.toFixed(2)} ms`;
  return { median, p95, max, text };
}

async function busyScene(page: Page) {
  await openApp(page);
  // Give every layer something to do: vectors and real eigenspaces.
  const addVector = panel(page, 'Vectors').getByRole('button', { name: 'Add vector' });
  for (let k = 0; k < 4; k++) await addVector.click();
  await presetButton(page, 'Shear y').click();
  await waitForRenderIdle(page);
}

test('frame cost during a 2 s pointer scrub', async ({ page }) => {
  await busyScene(page);
  await startFrameSampling(page);
  // Real pointer events. Headless Chromium acknowledges each synthetic move only after a
  // composited frame (~100+ ms under SwiftShader), so this yields fewer frames than a real drag.
  const grip = await grabCell(page, 2, 1);
  const start = Date.now();
  let k = 0;
  while (Date.now() - start < 2000) {
    await grip.moveTo(80 * Math.sin(k / 3));
    k++;
  }
  await grip.release();
  const s = stats(await stopFrameSampling(page));
  const report = `pointer scrub, ${k} moves: engine ${s.text} (SwiftShader)`;
  test.info().annotations.push({ type: 'frame cost', description: report });
  console.log(report);
  expect(k).toBeGreaterThan(5);
  expect(s.median).toBeLessThan(12);
});

test('frame cost during a 2 s per-frame scrub (entry slider)', async ({ page }) => {
  await busyScene(page);
  await panel(page, 'Matrix').getByRole('button', { name: 'Entry sliders' }).click();
  const slider = panel(page, 'Matrix').getByRole('slider', { name: /^a₂₁/ });
  await expect(slider).toBeVisible();
  await startFrameSampling(page);

  // One 'live' edit per animation frame for 2 s, driven inside the page. For each frame also
  // measure the whole main-thread cost (rAF start → after style/layout/paint of that frame),
  // which includes the UI work (Svelte, KaTeX) that lastFrameMs does not see.
  const { edits, frameTotal } = await slider.evaluate(
    (el) =>
      new Promise<{ edits: number; frameTotal: number[] }>((resolve) => {
        const input = el as HTMLInputElement;
        const frameTotal: number[] = [];
        const channel = new MessageChannel();
        let t0 = 0;
        channel.port1.onmessage = () => frameTotal.push(performance.now() - t0);
        const start = performance.now();
        let edits = 0;
        const step = (now: number) => {
          t0 = performance.now();
          input.value = String(Math.round(300 * Math.sin(edits / 10)) / 100);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          edits++;
          channel.port2.postMessage(0);
          if (now - start < 2000) requestAnimationFrame(step);
          else {
            input.dispatchEvent(new Event('change', { bubbles: true }));
            setTimeout(() => resolve({ edits, frameTotal }), 50);
          }
        };
        requestAnimationFrame(step);
      }),
  );
  await waitForRenderIdle(page);
  const engine = stats(await stopFrameSampling(page));
  const total = stats(frameTotal);
  const report =
    `slider scrub, ${edits} live edits in 2 s: engine (lastFrameMs) ${engine.text}; ` +
    `whole main-thread frame ${total.text} (SwiftShader)`;
  test.info().annotations.push({ type: 'frame cost', description: report });
  console.log(report);

  // The whole gesture is still one undo step.
  await toolbarButton(page, 'Undo').click();
  await expect(cell(page, 2, 1)).toHaveAttribute('aria-valuenow', '1');

  expect(edits).toBeGreaterThan(10);
  expect(engine.median).toBeLessThan(12);
});

test.describe('layout', () => {
  test('375×812: no horizontal page scroll and the bottom sheet is visible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openApp(page);
    const sheet = page.getByRole('region', { name: 'Inspector' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Resize panel sheet' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Inspector' })).toHaveCount(0);
    await expect(
      page.getByRole('banner').getByRole('button', { name: 'Copy share link' }),
    ).toBeVisible();

    const noHorizontalScroll = () =>
      page.evaluate(() => {
        const d = document.documentElement;
        return d.scrollWidth <= d.clientWidth && document.body.scrollWidth <= d.clientWidth;
      });
    expect(await noHorizontalScroll()).toBe(true);

    // Wider content: a 3×3 matrix and a few 3D vectors.
    await page.keyboard.press('3');
    await expectDim(page, 3);
    for (let k = 0; k < 3; k++) {
      await panel(page, 'Vectors').getByRole('button', { name: 'Add vector' }).click();
    }
    expect(await noHorizontalScroll()).toBe(true);
    // The matrix fits inside the sheet.
    const sheetBox = await sheet.boundingBox();
    const matrixBox = await panel(page, 'Matrix').getByRole('group').boundingBox();
    expect(sheetBox && matrixBox).toBeTruthy();
    if (sheetBox && matrixBox) {
      expect(matrixBox.x).toBeGreaterThanOrEqual(sheetBox.x);
      expect(matrixBox.x + matrixBox.width).toBeLessThanOrEqual(sheetBox.x + sheetBox.width);
    }

    // The sheet handle toggles peek ↔ half via the keyboard.
    const handle = sheet.getByRole('button', { name: 'Resize panel sheet' });
    await expect(handle).toHaveAttribute('aria-expanded', 'true');
    await handle.focus();
    await page.keyboard.press('ArrowDown');
    await expect(handle).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('ArrowUp');
    await expect(handle).toHaveAttribute('aria-expanded', 'true');
  });
});

test.describe('centring', () => {
  /** Screen position of the 2D origin: the "0" corner label's top-right corner sits on it. */
  const origin = (page: Page) =>
    page.evaluate(() => {
      const el = document.querySelector('.ltv-tick-corner');
      if (!el || getComputedStyle(el).display === 'none') return null;
      const r = el.getBoundingClientRect();
      return { x: r.right, y: r.top };
    });

  test('1440×900: the scene is centred in the area not covered by the inspector', async ({
    page,
  }) => {
    await openApp(page);
    await waitForRenderIdle(page);
    const side = await inspector(page).boundingBox();
    if (!side) throw new Error('inspector has no box');
    const expected = { x: side.x / 2, y: 900 / 2 };
    const o = await origin(page);
    test.info().annotations.push({
      type: 'origin',
      description: `origin ${JSON.stringify(o)}, expected ${JSON.stringify(expected)}`,
    });
    expect(o).not.toBeNull();
    expect(Math.abs((o?.x ?? 0) - expected.x)).toBeLessThanOrEqual(1);
    expect(Math.abs((o?.y ?? 0) - expected.y)).toBeLessThanOrEqual(1);
    expect(o?.x ?? 0).toBeLessThan(1440 / 2);

    // Collapsing the sidebar to its rail re-centres the scene in the full window.
    await inspector(page).getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect.poll(async () => (await origin(page))?.x).toBeCloseTo(720, 0);

    await inspector(page).getByRole('button', { name: 'Expand sidebar' }).click();
    await expect.poll(async () => (await origin(page))?.x).toBeCloseTo(expected.x, 0);

    // A window resize keeps it centred in the uncovered area.
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect
      .poll(async () => {
        const s = await inspector(page).boundingBox();
        const p = await origin(page);
        return s && p ? Math.round(Math.abs(p.x - s.x / 2) + Math.abs(p.y - 400)) : null;
      })
      .toBeLessThanOrEqual(1);
  });

  test('375×812: the scene is centred between the toolbar and the bottom sheet', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openApp(page);
    await waitForRenderIdle(page);
    const bar = await page.getByRole('banner').boundingBox();
    const sheet = await page.getByRole('region', { name: 'Inspector' }).boundingBox();
    if (!bar || !sheet) throw new Error('missing toolbar/sheet box');
    const o = await origin(page);
    expect(o).not.toBeNull();
    expect(Math.abs((o?.x ?? 0) - 375 / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs((o?.y ?? 0) - (bar.y + bar.height + sheet.y) / 2)).toBeLessThanOrEqual(1);
  });
});
