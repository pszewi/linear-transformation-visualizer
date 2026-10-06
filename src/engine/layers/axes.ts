/**
 * Axes: axis lines, integer ticks, CSS2D tick numbers and axis names.
 *  2D: ticks keep a constant pixel length; tick numbers thin out as you zoom out and stick to
 *      the viewport edge when their axis is panned out of view.
 *  3D: axes tinted with the muted basis colours, ticks and numbers in world units.
 * Static geometry; only per-render screen-space layout (no per-frame allocation).
 */
import { type Camera, OrthographicCamera, Vector3, type WebGLRenderer } from 'three';
import { formatNumber } from '../../core/format';
import type { FrameState, LayerContext } from '../types';
import type { Label } from '../primitives/Label';
import { type Segments, staticSegments } from '../primitives/lines';
import { worldPerPixel } from '../primitives/screen';
import { ORDER } from '../renderOrder';
import { BaseLayer } from './BaseLayer';
import { GRID_2D_RANGE } from './grid';

const AXIS_3D = 4;
const TICK_3D = 0.07;
/** Half tick length in 2D, CSS px. */
const TICK_PX = 4;
/** Minimum spacing between 2D tick numbers, CSS px. */
const LABEL_SPACING_PX = 34;
const STEPS = [1, 2, 5, 10, 20, 50] as const;

const _origin = new Vector3();

interface TickLabel {
  readonly label: Label;
  readonly value: number;
}

export class AxesLayer extends BaseLayer {
  readonly id = 'axes';
  private xTicks: Segments | null = null;
  private yTicks: Segments | null = null;
  private xLabels: TickLabel[] = [];
  private yLabels: TickLabel[] = [];
  private xName: Label | null = null;
  private yName: Label | null = null;
  private origin: Label | null = null;

  protected build(ctx: LayerContext): void {
    if (ctx.dim === 2) this.build2D(ctx);
    else this.build3D(ctx);
  }

  update(_frame: FrameState): void {
    // Static: axes do not depend on the map.
  }

  private build2D(ctx: LayerContext): void {
    const p = ctx.palette;
    const R = GRID_2D_RANGE;
    const axes = this.segments(
      this.geometry(staticSegments(new Float32Array([-R, 0, 0, R, 0, 0, 0, -R, 0, 0, R, 0]))),
      { color: p.axis, width: 1.5, opacity: 0.9 },
      ORDER.axes - 0.1, // renders before the ticks, so its hook lays them out first
    );
    axes.hook = this.layout2D;

    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = -R; i <= R; i++) {
      if (i === 0) continue;
      xs.push(i, -1, 0, i, 1, 0);
      ys.push(-1, i, 0, 1, i, 0);
    }
    const tickStyle = { color: p.tick, width: 1.25, opacity: 0.9 };
    this.xTicks = this.segments(
      this.geometry(staticSegments(new Float32Array(xs))),
      tickStyle,
      ORDER.axes,
    );
    this.yTicks = this.segments(
      this.geometry(staticSegments(new Float32Array(ys))),
      tickStyle,
      ORDER.axes,
    );
    this.xTicks.matrixAutoUpdate = false;
    this.yTicks.matrixAutoUpdate = false;

    for (let i = -R; i <= R; i++) {
      if (i === 0) continue;
      const lx = this.label(formatNumber(i), 'ltv-tick ltv-tick-below');
      lx.object.position.set(i, 0, 0);
      lx.object.center.set(0.5, 0);
      ctx.root.add(lx.object);
      this.xLabels.push({ label: lx, value: i });
      const ly = this.label(formatNumber(i), 'ltv-tick ltv-tick-left');
      ly.object.position.set(0, i, 0);
      ly.object.center.set(1, 0.5);
      ctx.root.add(ly.object);
      this.yLabels.push({ label: ly, value: i });
    }
    this.origin = this.label('0', 'ltv-tick ltv-tick-corner');
    this.origin.object.center.set(1, 0);
    ctx.root.add(this.origin.object);

    this.xName = this.label('x', 'ltv-axis-name ltv-axis-name-x');
    this.xName.object.center.set(1, 1);
    this.yName = this.label('y', 'ltv-axis-name ltv-axis-name-y');
    this.yName.object.center.set(0, 0);
    ctx.root.add(this.xName.object, this.yName.object);
  }

  /** Per-render 2D layout: tick length, label thinning, edge-clamping. */
  private readonly layout2D = (renderer: WebGLRenderer, camera: Camera): void => {
    if (!(camera instanceof OrthographicCamera)) return;
    const wpp = worldPerPixel(camera, renderer, _origin);
    const left = camera.position.x + camera.left / camera.zoom;
    const right = camera.position.x + camera.right / camera.zoom;
    const bottom = camera.position.y + camera.bottom / camera.zoom;
    const top = camera.position.y + camera.top / camera.zoom;

    const tick = TICK_PX * wpp;
    if (this.xTicks) {
      this.xTicks.matrix.makeScale(1, tick, 1);
      this.xTicks.matrixWorld.copy(this.xTicks.matrix);
    }
    if (this.yTicks) {
      this.yTicks.matrix.makeScale(tick, 1, 1);
      this.yTicks.matrixWorld.copy(this.yTicks.matrix);
    }

    let step: number = STEPS[STEPS.length - 1];
    for (const s of STEPS) {
      if (s / wpp >= LABEL_SPACING_PX) {
        step = s;
        break;
      }
    }

    // Keep numbers on screen when their axis is panned away.
    const xAxisY = clamp(0, bottom + 22 * wpp, top - 6 * wpp);
    const yAxisX = clamp(0, left + 36 * wpp, right - 6 * wpp);
    const margin = 8 * wpp;
    for (const t of this.xLabels) {
      const show = t.value % step === 0 && t.value > left + margin && t.value < right - margin;
      t.label.visible = show;
      if (show) t.label.object.position.y = xAxisY;
    }
    for (const t of this.yLabels) {
      const show = t.value % step === 0 && t.value > bottom + margin && t.value < top - margin;
      t.label.visible = show;
      if (show) t.label.object.position.x = yAxisX;
    }
    if (this.origin) {
      this.origin.visible = xAxisY === 0 && yAxisX === 0;
      this.origin.object.position.set(0, 0, 0);
    }
    // Names sit above-left of the x axis' right end and right of the y axis' top end; keep the
    // whole label inside the view even when the axis is clamped to an edge.
    if (this.xName) {
      this.xName.object.position.set(right - 10 * wpp, Math.min(xAxisY, top - 24 * wpp), 0);
    }
    if (this.yName) {
      this.yName.object.position.set(
        Math.min(yAxisX, right - 24 * wpp) + 6 * wpp,
        top - 8 * wpp,
        0,
      );
    }
  };

  private build3D(ctx: LayerContext): void {
    const p = ctx.palette;
    const L = AXIS_3D;
    const ticks: number[] = [];
    for (let k = 0; k < 3; k++) {
      const pos = [0, 0, 0, 0, 0, 0];
      pos[k] = -L;
      pos[3 + k] = L;
      this.segments(
        this.geometry(staticSegments(new Float32Array(pos))),
        { color: p.basisBefore[k], width: 1.75, opacity: 1 },
        ORDER.axes,
      );
      // Ticks cross the axis: the y axis along x, the x and z axes along y.
      const across = k === 1 ? 0 : 1;
      for (let i = -L + 1; i <= L - 1; i++) {
        if (i === 0) continue;
        const a = [0, 0, 0];
        const b = [0, 0, 0];
        a[k] = i;
        b[k] = i;
        a[across] = -TICK_3D;
        b[across] = TICK_3D;
        ticks.push(...a, ...b);
        // Numbers on the positive half only: negatives add clutter in perspective.
        if (i < 0) continue;
        const l = this.label(
          formatNumber(i),
          k === 2 ? 'ltv-tick ltv-tick-left' : 'ltv-tick ltv-tick-below',
        );
        l.object.position.set(a[0], a[1], a[2]);
        l.object.position.setComponent(across, 0);
        l.object.center.set(k === 2 ? 1 : 0.5, k === 2 ? 0.5 : 0);
        ctx.root.add(l.object);
      }
      const name = this.label('xyz'[k], 'ltv-axis-name ltv-axis-name-tinted');
      name.setColor(p.basisLabels[k]);
      name.object.position.setComponent(k, L + 0.35);
      ctx.root.add(name.object);
    }
    this.segments(
      this.geometry(staticSegments(new Float32Array(ticks))),
      { color: p.tick, width: 1.25, opacity: 0.8 },
      ORDER.axes,
    );
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return lo > hi ? x : Math.min(hi, Math.max(lo, x));
}
