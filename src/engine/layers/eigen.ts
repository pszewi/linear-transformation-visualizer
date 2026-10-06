/**
 * Real eigenspaces from frame.analysis.eigen:
 *  geometric dim 1 → dashed line through the origin spanning the view, labelled "λ = …";
 *  geometric dim 2 (3D) → translucent plane patch with an outline;
 *  geometric dim = n → nothing (every vector is an eigenvector).
 * Objects come from small pools that only grow; lines/planes are oriented by their object
 * matrix (fixed geometry), so a changing eigenvector costs a matrix write, not a rebuild.
 */
import {
  type Camera,
  DoubleSide,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from 'three';
import type { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { EigenSpace } from '../../core/analysis';
import { formatNumber } from '../../core/format';
import type { FrameState, LayerContext } from '../types';
import type { Label } from '../primitives/Label';
import { HookedMesh, type Segments, staticSegments } from '../primitives/lines';
import { labelCenterFor, worldPerPixel } from '../primitives/screen';
import { ORDER } from '../renderOrder';
import { BaseLayer } from './BaseLayer';

const DASH_PX = 9;
const GAP_PX = 6;
const PLANE_HALF = 2;
/** 2D label placement: keep this far inside the view, and back off from the exit point. */
const LABEL_INSET_PX = 28;
const LABEL_BACKOFF_PX = 70;

const _origin = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _n = new Vector3();
const _center = new Vector2();

interface LineSlot {
  readonly line: Segments;
  readonly label: Label;
  readonly dir: Vector3;
  value: number;
}

interface PlaneSlot {
  readonly mesh: HookedMesh;
  readonly outline: Segments;
  readonly label: Label;
  value: number;
}

export class EigenLayer extends BaseLayer {
  readonly id = 'eigen';
  private lineGeometry: LineSegmentsGeometry | null = null;
  private planeGeometry: PlaneGeometry | null = null;
  private outlineGeometry: LineSegmentsGeometry | null = null;
  private planeMaterial: MeshBasicMaterial | null = null;
  private readonly lines: LineSlot[] = [];
  private readonly planes: PlaneSlot[] = [];
  private halfLength = 1;

  protected build(ctx: LayerContext): void {
    this.halfLength = ctx.dim === 2 ? 200 : 8;
    const R = this.halfLength;
    this.lineGeometry = this.geometry(
      staticSegments(new Float32Array([-R, 0, 0, R, 0, 0]), new Float32Array([0, 2 * R])),
    );
    if (ctx.dim === 3) {
      const P = PLANE_HALF;
      this.planeGeometry = this.geometry(new PlaneGeometry(2 * P, 2 * P));
      // prettier-ignore
      this.outlineGeometry = this.geometry(staticSegments(new Float32Array([
        -P, -P, 0, P, -P, 0,  P, -P, 0, P, P, 0,  P, P, 0, -P, P, 0,  -P, P, 0, -P, -P, 0,
      ])));
      this.planeMaterial = this.own(
        new MeshBasicMaterial({
          color: ctx.palette.eigen,
          transparent: true,
          opacity: ctx.palette.eigenPlaneOpacity,
          depthWrite: false,
          side: DoubleSide,
        }),
      );
    }
    // Typical counts: up to n lines, at most one plane. Pools grow on demand.
    for (let i = 0; i < ctx.dim; i++) this.addLine();
    if (ctx.dim === 3) this.addPlane();
  }

  private addLine(): LineSlot {
    if (!this.lineGeometry) throw new Error('eigen: not built');
    const p = this.ctx.palette;
    const line = this.segments(
      this.lineGeometry,
      {
        color: p.eigen,
        width: 2,
        opacity: p.eigenOpacity,
        dash: { dash: DASH_PX, gap: GAP_PX },
      },
      ORDER.eigenLine,
    );
    line.matrixAutoUpdate = false;
    line.visible = false;
    const slot: LineSlot = {
      line,
      label: this.label('', 'ltv-eigen'),
      dir: new Vector3(1, 0, 0),
      value: NaN,
    };
    slot.label.visible = false;
    this.ctx.root.add(slot.label.object);
    line.hook = (renderer, camera) => this.layoutLine(slot, renderer, camera);
    this.lines.push(slot);
    return slot;
  }

  private addPlane(): PlaneSlot {
    if (!this.planeGeometry || !this.outlineGeometry || !this.planeMaterial) {
      throw new Error('eigen: planes need 3D');
    }
    const p = this.ctx.palette;
    const mesh = new HookedMesh(this.planeGeometry, this.planeMaterial);
    mesh.renderOrder = ORDER.eigenPlane;
    mesh.matrixAutoUpdate = false;
    mesh.visible = false;
    this.ctx.root.add(mesh);
    const outline = this.segments(
      this.outlineGeometry,
      { color: p.eigen, width: 1.25, opacity: 0.55 },
      ORDER.eigenLine,
    );
    outline.matrixAutoUpdate = false;
    outline.visible = false;
    const slot: PlaneSlot = { mesh, outline, label: this.label('', 'ltv-eigen'), value: NaN };
    slot.label.visible = false;
    this.ctx.root.add(slot.label.object);
    this.planes.push(slot);
    return slot;
  }

  update(frame: FrameState): void {
    if (!frame.matrixChanged) return;
    const eigen = frame.analysis.eigen;
    const n = frame.shape.rows;
    let li = 0;
    let pi = 0;
    if (eigen && frame.analysis.square) {
      for (const s of eigen.spaces) {
        if (s.value.im !== 0 || s.basis.length === 0 || s.basis.length >= n) continue;
        if (s.basis.length === 1) {
          const slot = li < this.lines.length ? this.lines[li] : this.addLine();
          this.showLine(slot, s);
          li++;
        } else if (s.basis.length === 2 && this.ctx.dim === 3) {
          const slot = pi < this.planes.length ? this.planes[pi] : this.addPlane();
          this.showPlane(slot, s);
          pi++;
        }
      }
    }
    for (let i = li; i < this.lines.length; i++) {
      this.lines[i].line.visible = false;
      this.lines[i].label.visible = false;
    }
    for (let i = pi; i < this.planes.length; i++) {
      const s = this.planes[i];
      s.mesh.visible = false;
      s.outline.visible = false;
      s.label.visible = false;
    }
  }

  private setValue(slot: { label: Label; value: number }, value: number): void {
    if (Math.abs(slot.value - value) < 5e-4) return;
    slot.value = value;
    slot.label.setText(`λ = ${formatNumber(value, 2)}`);
  }

  private showLine(slot: LineSlot, s: EigenSpace): void {
    const v = s.basis[0];
    const d = slot.dir.set(v[0] ?? 0, v[1] ?? 0, v.length > 2 ? v[2] : 0);
    if (d.lengthSq() === 0) return;
    d.normalize();
    // Canonical sign so the label does not jump sides when the solver flips the vector.
    if (d.z < 0 || (d.z === 0 && (d.y < 0 || (d.y === 0 && d.x < 0)))) d.negate();
    perpendicularFrame(d, _a, _b);
    slot.line.matrix.makeBasis(d, _a, _b);
    slot.line.matrixWorldNeedsUpdate = true;
    slot.line.visible = true;
    slot.label.visible = true;
    this.setValue(slot, s.value.re);
    if (this.ctx.dim === 3) slot.label.object.position.copy(d).multiplyScalar(2.45);
  }

  private showPlane(slot: PlaneSlot, s: EigenSpace): void {
    const b1 = s.basis[0];
    const b2 = s.basis[1];
    _a.set(b1[0], b1[1], b1[2]).normalize();
    _b.set(b2[0], b2[1], b2[2]);
    _b.addScaledVector(_a, -_b.dot(_a)).normalize();
    _n.crossVectors(_a, _b);
    slot.mesh.matrix.makeBasis(_a, _b, _n);
    slot.mesh.matrixWorldNeedsUpdate = true;
    slot.outline.matrix.copy(slot.mesh.matrix);
    slot.outline.matrixWorldNeedsUpdate = true;
    slot.mesh.visible = true;
    slot.outline.visible = true;
    slot.label.visible = true;
    slot.label.object.position
      .copy(_a)
      .add(_b)
      .multiplyScalar(PLANE_HALF * 0.92);
    this.setValue(slot, s.value.re);
  }

  /** Per-render: pixel-constant dashes anchored at the origin; keep the 2D label in view. */
  private layoutLine(slot: LineSlot, renderer: WebGLRenderer, camera: Camera): void {
    const wpp = worldPerPixel(camera, renderer, _origin);
    const m = slot.line.material;
    m.dashScale = 1 / wpp;
    const period = DASH_PX + GAP_PX;
    const atOrigin = this.halfLength / wpp;
    m.dashOffset = DASH_PX / 2 - (atOrigin % period);
    if (camera instanceof OrthographicCamera) {
      // Clip the line against the (inset) view rectangle; put the label near where it exits.
      const d = slot.dir;
      const inset = LABEL_INSET_PX * wpp;
      const x0 = camera.position.x + camera.left / camera.zoom + inset;
      const x1 = camera.position.x + camera.right / camera.zoom - inset;
      const y0 = camera.position.y + camera.bottom / camera.zoom + inset;
      const y1 = camera.position.y + camera.top / camera.zoom - inset;
      let tMin = -Infinity;
      let tMax = Infinity;
      if (Math.abs(d.x) > 1e-9) {
        const a = x0 / d.x;
        const b = x1 / d.x;
        tMin = Math.max(tMin, Math.min(a, b));
        tMax = Math.min(tMax, Math.max(a, b));
      } else if (x0 > 0 || x1 < 0) tMax = -Infinity;
      if (Math.abs(d.y) > 1e-9) {
        const a = y0 / d.y;
        const b = y1 / d.y;
        tMin = Math.max(tMin, Math.min(a, b));
        tMax = Math.min(tMax, Math.max(a, b));
      } else if (y0 > 0 || y1 < 0) tMax = -Infinity;
      const inView = tMin < tMax;
      slot.label.visible = inView;
      if (inView) {
        const t = Math.max((tMin + tMax) / 2, tMax - LABEL_BACKOFF_PX * wpp);
        slot.label.object.position.set(d.x * t, d.y * t, 0);
        // Beside the line, on its upper side.
        labelCenterFor(-d.y, d.x, _center);
        slot.label.object.center.copy(_center);
      }
    }
  }
}

/** Orthonormal a, b completing unit d to a right-handed frame. */
function perpendicularFrame(d: Vector3, a: Vector3, b: Vector3): void {
  if (Math.abs(d.z) < 0.9) a.set(-d.y, d.x, 0);
  else a.set(0, -d.z, d.y);
  a.normalize();
  b.crossVectors(d, a);
}
