/**
 * Arrow = fat-line shaft + head mesh, with a CONSTANT SCREEN-SIZE head.
 *
 * Geometry is shared per ArrowKit (one unit segment, one head) and never rebuilt: `set()` only
 * stores the endpoints; the per-render hook (which knows the camera) writes the shaft/head
 * matrices so the head stays the same number of pixels at any zoom or distance.
 */
import {
  BufferGeometry,
  type Camera,
  ConeGeometry,
  Float32BufferAttribute,
  Group,
  MeshBasicMaterial,
  MeshLambertMaterial,
  DoubleSide,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from 'three';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { Dim } from '../types';
import type { Label } from './Label';
import { createLineMaterial, HookedMesh, Segments, unitSegment } from './lines';
import { labelCenterFor, screenDirection, worldPerPixel } from './screen';

/** Below this world length an arrow is considered zero and hidden (rendering threshold). */
export const ZERO_LENGTH = 1e-9;

export interface ArrowStyle {
  readonly color: number;
  /** Shaft width, CSS px. */
  readonly width?: number;
  readonly opacity?: number;
  /** Head length / width in CSS px. */
  readonly headLength?: number;
  readonly headWidth?: number;
  readonly renderOrder?: number;
  /**
   * Colour of a thin outline drawn just behind the arrow (normally the background colour), so
   * an arrow stays distinct from coincident lines of a similar hue (e.g. Ae₁ on the image of
   * the x axis). Omit for no outline.
   */
  readonly casing?: number;
}

/** Outline thickness on each side, CSS px. */
const CASING_PX = 1.5;

/** Fraction of the head length (from the tip) where the shaft ends, hidden under the head. */
const SHAFT_INSET = 0.7;

const _end = new Vector3();
const _x = new Vector3();
const _screen = new Vector2();
const _center = new Vector2();

/** Shared geometry + factory; owns (and disposes) every arrow it created. */
export class ArrowKit {
  readonly dim: Dim;
  readonly shaftGeometry: LineSegmentsGeometry;
  readonly headGeometry: BufferGeometry;
  private readonly arrows: Arrow[] = [];

  constructor(dim: Dim) {
    this.dim = dim;
    this.shaftGeometry = unitSegment();
    this.headGeometry = dim === 2 ? flatHead() : coneHead();
  }

  create(style: ArrowStyle): Arrow {
    const a = new Arrow(this, style);
    this.arrows.push(a);
    return a;
  }

  dispose(): void {
    for (const a of this.arrows) a.dispose();
    this.arrows.length = 0;
    this.shaftGeometry.dispose();
    this.headGeometry.dispose();
  }
}

/**
 * 2D head: a slim "stealth" arrowhead in the local XY plane. Tip at the origin pointing +Y,
 * base at y = −1, width 1, with a shallow notch so the shaft joins cleanly.
 */
function flatHead(): BufferGeometry {
  const g = new BufferGeometry();
  // prettier-ignore
  const p = new Float32Array([
    0, 0, 0,
    -0.5, -1, 0,
    0, -0.82, 0,
    0.5, -1, 0,
  ]);
  g.setAttribute('position', new Float32BufferAttribute(p, 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/** 3D head: cone with tip at the origin pointing +Y, base at y = −1, diameter 1. */
function coneHead(): BufferGeometry {
  const g = new ConeGeometry(0.5, 1, 24, 1);
  g.translate(0, -0.5, 0);
  return g;
}

export class Arrow {
  readonly object = new Group();
  readonly shaft: Segments;
  readonly head: HookedMesh;
  readonly shaftMaterial: LineMaterial;
  /** Flat in 2D; in 3D lit (engine headlight) so a cone reads as a cone from any angle. */
  readonly headMaterial: MeshBasicMaterial | MeshLambertMaterial;
  private label: Label | null = null;
  private readonly casingShaft: Segments | null = null;
  private readonly casingHead: HookedMesh | null = null;
  private readonly casingMaterials: (LineMaterial | MeshBasicMaterial)[] = [];

  private readonly dim: Dim;
  private readonly headLength: number;
  private readonly headWidth: number;
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  private readonly dir = new Vector3();
  private readonly perp1 = new Vector3();
  private readonly perp2 = new Vector3();
  private len = 0;

  constructor(kit: ArrowKit, style: ArrowStyle) {
    this.dim = kit.dim;
    const depth = kit.dim === 3;
    const opacity = style.opacity ?? 1;
    // Cones are foreshortened in perspective: make them a little longer than flat heads.
    this.headLength = (style.headLength ?? 12) * (kit.dim === 3 ? 1.3 : 1);
    this.headWidth = style.headWidth ?? 9;
    this.shaftMaterial = createLineMaterial({
      color: style.color,
      width: style.width ?? 2.5,
      opacity,
      depth,
    });
    const headParams = {
      color: style.color,
      transparent: true,
      opacity,
      depthTest: depth,
      depthWrite: depth && opacity >= 1,
      side: DoubleSide,
    };
    this.headMaterial = depth
      ? new MeshLambertMaterial(headParams)
      : new MeshBasicMaterial(headParams);
    this.shaft = new Segments(kit.shaftGeometry, this.shaftMaterial);
    this.head = new HookedMesh(kit.headGeometry, this.headMaterial);
    const order = style.renderOrder ?? 0;
    const parts = [this.shaft, this.head];
    // 2D only: in 3D depth and shading already separate arrows, and an outline would double
    // the edges of the translucent cube faces it sits on.
    if (style.casing !== undefined && kit.dim === 2) {
      const lm = createLineMaterial({
        color: style.casing,
        width: (style.width ?? 2.5) + 2 * CASING_PX,
        opacity,
        depth,
      });
      lm.depthWrite = false;
      const hm = new MeshBasicMaterial({
        color: style.casing,
        transparent: true,
        opacity,
        depthTest: depth,
        depthWrite: false,
        side: DoubleSide,
      });
      this.casingMaterials.push(lm, hm);
      this.casingShaft = new Segments(kit.shaftGeometry, lm);
      this.casingHead = new HookedMesh(kit.headGeometry, hm);
      this.casingShaft.renderOrder = order - 0.5;
      this.casingHead.renderOrder = order - 0.5;
      parts.push(this.casingShaft, this.casingHead);
    }
    for (const o of parts) {
      o.matrixAutoUpdate = false;
      if (o !== this.casingShaft && o !== this.casingHead) o.renderOrder = order;
      o.hook = this.layout;
      this.object.add(o);
    }
    this.object.visible = false;
  }

  setColor(hex: number): void {
    this.shaftMaterial.color.setHex(hex);
    this.headMaterial.color.setHex(hex);
  }

  setOpacity(opacity: number): void {
    this.shaftMaterial.opacity = opacity;
    this.headMaterial.opacity = opacity;
    for (const m of this.casingMaterials) m.opacity = opacity;
  }

  /** Attach a label that follows the tip, placed just beyond it on screen. */
  attachLabel(label: Label): void {
    this.label = label;
    this.object.add(label.object);
  }

  hide(): void {
    this.object.visible = false;
  }

  /** Set endpoints (world). Zero-length arrows are hidden. Does not allocate. */
  set(ax: number, ay: number, az: number, bx: number, by: number, bz: number): void {
    this.from.set(ax, ay, az);
    this.to.set(bx, by, bz);
    this.dir.subVectors(this.to, this.from);
    this.len = this.dir.length();
    const visible = this.len > ZERO_LENGTH && Number.isFinite(this.len);
    this.object.visible = visible;
    if (!visible) return;
    this.dir.divideScalar(this.len);
    const d = this.dir;
    if (this.dim === 2) {
      this.perp1.set(-d.y, d.x, 0);
      this.perp2.set(0, 0, 1);
    } else {
      // Any orthonormal frame around d (the cone is round).
      if (Math.abs(d.z) < 0.9) this.perp1.set(-d.y, d.x, 0);
      else this.perp1.set(0, -d.z, d.y);
      this.perp1.normalize();
      this.perp2.crossVectors(d, this.perp1);
    }
    if (this.label) this.label.object.position.copy(this.to);
  }

  /** Per-render: size the head in pixels and fit the shaft to it. */
  private readonly layout = (renderer: WebGLRenderer, camera: Camera): void => {
    const wpp = worldPerPixel(camera, renderer, this.to);
    let hl = this.headLength * wpp;
    let hw = this.headWidth * wpp;
    const maxHl = this.len * 0.5;
    if (hl > maxHl) {
      hw *= maxHl / hl;
      hl = maxHl;
    }
    const d = this.dir;
    const p1 = this.perp1;
    const p2 = this.perp2;
    const f = this.from;
    const t = this.to;

    _end.copy(t).addScaledVector(d, -hl * SHAFT_INSET);
    _x.subVectors(_end, f);
    // prettier-ignore
    this.shaft.matrix.set(
      _x.x, p1.x, p2.x, f.x,
      _x.y, p1.y, p2.y, f.y,
      _x.z, p1.z, p2.z, f.z,
      0, 0, 0, 1,
    );
    this.shaft.matrixWorld.multiplyMatrices(this.object.matrixWorld, this.shaft.matrix);

    // prettier-ignore
    this.head.matrix.set(
      p1.x * hw, d.x * hl, p2.x * hw, t.x,
      p1.y * hw, d.y * hl, p2.y * hw, t.y,
      p1.z * hw, d.z * hl, p2.z * hw, t.z,
      0, 0, 0, 1,
    );
    this.head.matrixWorld.multiplyMatrices(this.object.matrixWorld, this.head.matrix);

    if (this.casingShaft && this.casingHead) {
      this.casingShaft.matrix.copy(this.shaft.matrix);
      this.casingShaft.matrixWorld.copy(this.shaft.matrixWorld);
      // Head outline: the same head, grown by the casing width and nudged past the tip.
      const c = CASING_PX * wpp;
      const hlc = hl + 2.4 * c;
      const hwc = hw + 2.6 * c;
      _end.copy(t).addScaledVector(d, 1.4 * c);
      const e = _end;
      // prettier-ignore
      this.casingHead.matrix.set(
        p1.x * hwc, d.x * hlc, p2.x * hwc, e.x,
        p1.y * hwc, d.y * hlc, p2.y * hwc, e.y,
        p1.z * hwc, d.z * hlc, p2.z * hwc, e.z,
        0, 0, 0, 1,
      );
      this.casingHead.matrixWorld.multiplyMatrices(this.object.matrixWorld, this.casingHead.matrix);
    }

    if (this.label) {
      if (this.dim === 2) labelCenterFor(d.x, d.y, _center);
      else {
        screenDirection(camera, renderer, t, d, _screen);
        labelCenterFor(_screen.x, _screen.y, _center);
      }
      this.label.object.center.copy(_center);
    }
  };

  dispose(): void {
    this.shaftMaterial.dispose();
    this.headMaterial.dispose();
    for (const m of this.casingMaterials) m.dispose();
    this.object.removeFromParent();
  }
}
