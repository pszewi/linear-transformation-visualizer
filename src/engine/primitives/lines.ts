/**
 * Fat-line helpers (LineSegments2 / LineMaterial) with preallocated buffers.
 *
 * Widths are CSS px (LineSegments2 keeps `resolution` current from the renderer viewport), so
 * strokes look identical at DPR 1 and 2; edges are smoothed by the renderer's MSAA.
 */
import {
  type BufferGeometry,
  type Camera,
  DoubleSide,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  type Material,
  Mesh,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

export interface LineStyle {
  readonly color: number;
  /** Stroke width in CSS px. */
  readonly width: number;
  readonly opacity?: number;
  /** Depth test/write (3D). 2D layers draw with depth off and rely on renderOrder. */
  readonly depth?: boolean;
  /** Dash pattern in "distance units" (see Segments.dashUnitsPerPixel). */
  readonly dash?: { readonly dash: number; readonly gap: number };
}

/**
 * LineMaterial normalises the screen-space segment direction. When a singular map collapses a
 * segment to a point (det = 0, zero matrix) that is normalize(0) = NaN, which some drivers turn
 * into stray triangles or flicker. Guard it: a collapsed segment draws as a round dot instead.
 */
const UNSAFE_DIR = 'dir = normalize( dir );';
const SAFE_DIR =
  'float dirLen = length( dir ); dir = dirLen > 1e-6 ? dir / dirLen : vec2( 1.0, 0.0 );';

export function createLineMaterial(style: LineStyle): LineMaterial {
  const opacity = style.opacity ?? 1;
  const depth = style.depth ?? true;
  const m = new LineMaterial({
    color: style.color,
    linewidth: style.width,
    transparent: true,
    opacity,
    depthTest: depth,
    depthWrite: depth && opacity >= 1,
    worldUnits: false,
    // The stroke quad is built in screen space, so its winding never depends on the object
    // matrix; but three flips the front face for det(matrixWorld) < 0 (e.g. a reflection under
    // matrix4), which would cull every stroke. Draw both sides.
    side: DoubleSide,
  });
  if (style.dash) {
    m.dashed = true;
    m.dashSize = style.dash.dash;
    m.gapSize = style.dash.gap;
  }
  if (m.vertexShader.includes(UNSAFE_DIR)) {
    m.vertexShader = m.vertexShader.replace(UNSAFE_DIR, SAFE_DIR);
  } else if (import.meta.env.DEV) {
    console.warn('LineMaterial shader changed; singular-map guard not applied');
  }
  return m;
}

/**
 * Build a static segment geometry from `positions` (xyz xyz per segment). When `distances` is
 * set, per-segment dash distances (start, end) are attached for dashed materials.
 */
export function staticSegments(
  positions: Float32Array,
  distances?: Float32Array,
): LineSegmentsGeometry {
  const g = new LineSegmentsGeometry();
  g.setPositions(positions);
  if (distances) attachDistances(g, distances);
  return g;
}

function attachDistances(g: LineSegmentsGeometry, distances: Float32Array): void {
  const buf = new InstancedInterleavedBuffer(distances, 2, 1);
  g.setAttribute('instanceDistanceStart', new InterleavedBufferAttribute(buf, 1, 0));
  g.setAttribute('instanceDistanceEnd', new InterleavedBufferAttribute(buf, 1, 1));
}

/** One segment from the origin to (1, 0, 0), with dash distances 0 → 1. */
export function unitSegment(): LineSegmentsGeometry {
  return staticSegments(new Float32Array([0, 0, 0, 1, 0, 0]), new Float32Array([0, 1]));
}

/** A segment geometry whose endpoints are rewritten in place (capacity fixed at creation). */
export class SegmentBuffer {
  readonly geometry = new LineSegmentsGeometry();
  readonly array: Float32Array;
  readonly capacity: number;
  private readonly buffer: InstancedInterleavedBuffer;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.array = new Float32Array(capacity * 6);
    this.geometry.setPositions(this.array);
    const attr = this.geometry.getAttribute('instanceStart') as InterleavedBufferAttribute;
    this.buffer = attr.data as InstancedInterleavedBuffer;
    this.geometry.instanceCount = 0;
  }

  set(i: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number): void {
    const a = this.array;
    const k = i * 6;
    a[k] = ax;
    a[k + 1] = ay;
    a[k + 2] = az;
    a[k + 3] = bx;
    a[k + 4] = by;
    a[k + 5] = bz;
  }

  /** Publish the first `count` segments to the GPU. */
  commit(count: number): void {
    this.geometry.instanceCount = Math.min(count, this.capacity);
    this.buffer.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
  }
}

/** Per-render callback with the active camera (for screen-constant sizing). */
export type RenderHook = (renderer: WebGLRenderer, camera: Camera) => void;

/**
 * LineSegments2 with an optional per-render hook. Frustum culling is off: these objects are
 * often placed by a (possibly singular) GPU matrix for which the bounding sphere is meaningless.
 */
export class Segments extends LineSegments2 {
  hook: RenderHook | null = null;

  constructor(geometry: LineSegmentsGeometry, material: LineMaterial) {
    super(geometry, material);
    this.frustumCulled = false;
  }

  override onBeforeRender(renderer: WebGLRenderer, _scene?: Scene, camera?: Camera): void {
    super.onBeforeRender(renderer);
    if (this.hook !== null && camera !== undefined) this.hook(renderer, camera);
  }
}

/** Mesh with an optional per-render hook; frustum culling off (see Segments). */
export class HookedMesh extends Mesh<BufferGeometry, Material> {
  hook: RenderHook | null = null;

  constructor(geometry: BufferGeometry, material: Material) {
    super(geometry, material);
    this.frustumCulled = false;
  }

  override onBeforeRender(renderer: WebGLRenderer, _scene: Scene, camera: Camera): void {
    if (this.hook !== null) this.hook(renderer, camera);
  }
}
