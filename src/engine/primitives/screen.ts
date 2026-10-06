/**
 * Screen-space helpers for primitives that keep a constant on-screen size (arrowheads, ticks,
 * dash patterns, label offsets). All functions write into module scratch and never allocate.
 */
import {
  type Camera,
  OrthographicCamera,
  PerspectiveCamera,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from 'three';

import type { ViewInsets } from '../types';

const _size = new Vector2();
const _v = new Vector3();
const _a = new Vector3();
const _b = new Vector3();

/** Viewport size in CSS px (never zero). */
export function viewportSize(renderer: WebGLRenderer, out: Vector2): Vector2 {
  renderer.getSize(out);
  if (out.x < 1) out.x = 1;
  if (out.y < 1) out.y = 1;
  return out;
}

/** World units covered by one CSS pixel at world point `at`. */
export function worldPerPixel(camera: Camera, renderer: WebGLRenderer, at: Vector3): number {
  const h = viewportSize(renderer, _size).y;
  if (camera instanceof OrthographicCamera) {
    return (camera.top - camera.bottom) / camera.zoom / h;
  }
  if (camera instanceof PerspectiveCamera) {
    _v.copy(at).applyMatrix4(camera.matrixWorldInverse);
    const depth = Math.max(-_v.z, camera.near);
    return (2 * depth * Math.tan((camera.fov * Math.PI) / 360)) / camera.zoom / h;
  }
  return 1 / h;
}

/**
 * Unit screen-space direction (x right, y up, in CSS px proportions) of the world direction
 * `dir` at world point `at`. Falls back to (1, 0) when the direction is degenerate on screen.
 */
export function screenDirection(
  camera: Camera,
  renderer: WebGLRenderer,
  at: Vector3,
  dir: Vector3,
  out: Vector2,
): Vector2 {
  viewportSize(renderer, _size);
  _a.copy(at).project(camera);
  _b.copy(at).add(dir).project(camera);
  out.set((_b.x - _a.x) * _size.x, (_b.y - _a.y) * _size.y);
  const len = out.length();
  if (!(len > 1e-6)) return out.set(1, 0);
  return out.divideScalar(len);
}

/**
 * CSS2DObject.center that places a label box just outside a point, on the side given by the
 * unit screen direction `sx, sy` (y up). The label's CSS padding provides the visual gap.
 */
export function labelCenterFor(sx: number, sy: number, out: Vector2): Vector2 {
  const m = Math.max(Math.abs(sx), Math.abs(sy)) || 1;
  return out.set(0.5 - (0.5 * sx) / m, 0.5 + (0.5 * sy) / m);
}

/** Axis-aligned world rectangle (2D, z = 0 plane). */
export interface Rect2D {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * The world-space rectangle visible in the area NOT covered by floating UI, for a 2D
 * orthographic view. Computed by unprojecting the NDC corners of the uncovered rectangle, so it
 * is exact under any zoom, pan or camera view offset (the engine shifts the projection by the
 * insets). Writes into `out`; never allocates.
 */
export function visibleRect2D(
  camera: OrthographicCamera,
  renderer: WebGLRenderer,
  insets: Readonly<ViewInsets>,
  out: Rect2D,
): Rect2D {
  viewportSize(renderer, _size);
  const nx0 = -1 + (2 * insets.left) / _size.x;
  const nx1 = 1 - (2 * insets.right) / _size.x;
  const ny0 = -1 + (2 * insets.bottom) / _size.y;
  const ny1 = 1 - (2 * insets.top) / _size.y;
  _a.set(nx0, ny0, 0).unproject(camera);
  _b.set(nx1, ny1, 0).unproject(camera);
  out.x0 = Math.min(_a.x, _b.x);
  out.x1 = Math.max(_a.x, _b.x);
  out.y0 = Math.min(_a.y, _b.y);
  out.y1 = Math.max(_a.y, _b.y);
  return out;
}
