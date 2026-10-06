/**
 * Camera rigs, one per ambient dimension. A rig owns its camera and OrbitControls (bound to the
 * engine's single canvas) and reports whether the view is still moving, so the engine renders
 * on demand only.
 */
import { MOUSE, OrthographicCamera, PerspectiveCamera, TOUCH, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { easeInOutCubic } from './Animator';
import type { ViewInsets } from './types';

export const RESET_MS = 600;

export interface CameraRig {
  readonly camera: OrthographicCamera | PerspectiveCamera;
  readonly controls: OrbitControls;
  /** Fit the full canvas size, centring the scene in the area not covered by `insets`. */
  resize(width: number, height: number, insets: ViewInsets): void;
  /** Advance the reset tween / damping. Returns true while the view is still moving. */
  update(now: number): boolean;
  /** Return to the home view (smoothly unless `animate` is false). */
  reset(animate: boolean): void;
  dispose(): void;
}

export interface RigOptions {
  readonly onChange: () => void;
  readonly reducedMotion: () => boolean;
}

export const NO_INSETS: ViewInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Shift the projection so the world origin lands in the centre of the uncovered rectangle:
 * a view offset of ((r − l)/2, (b − t)/2) moves the image left/up by that many pixels.
 * Also refreshes the projection matrix.
 */
function applyInsets(
  camera: OrthographicCamera | PerspectiveCamera,
  width: number,
  height: number,
  insets: ViewInsets,
): void {
  const dx = (insets.right - insets.left) / 2;
  const dy = (insets.bottom - insets.top) / 2;
  if (dx === 0 && dy === 0) camera.clearViewOffset();
  else camera.setViewOffset(width, height, dx, dy, width, height);
  camera.updateProjectionMatrix();
}

/** Shared tween bookkeeping for a reset. */
class Tween {
  private start = -1;
  active = false;

  begin(): void {
    this.active = true;
    this.start = -1;
  }

  /** Eased progress in [0, 1]; the first call anchors the start time. */
  progress(now: number): number {
    if (this.start < 0) this.start = now;
    const t = Math.min(1, (now - this.start) / RESET_MS);
    if (t >= 1) this.active = false;
    return easeInOutCubic(t);
  }
}

/** Half the visible world height at zoom 1: the home view shows y ∈ [−6, 6]. */
const HALF_HEIGHT_2D = 6;

export class CameraRig2D implements CameraRig {
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  readonly controls: OrbitControls;
  private readonly tween = new Tween();
  private readonly fromPos = new Vector3();
  private fromZoom = 1;

  constructor(
    dom: HTMLElement,
    private readonly options: RigOptions,
  ) {
    this.camera.position.set(0, 0, 10);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
    const c = new OrbitControls(this.camera, dom);
    c.enableRotate = false;
    c.enableDamping = false;
    c.screenSpacePanning = true;
    c.zoomToCursor = true;
    c.minZoom = 0.25;
    c.maxZoom = 8;
    c.zoomSpeed = 1.2;
    c.mouseButtons = { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };
    c.touches = { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN };
    c.addEventListener('change', options.onChange);
    c.addEventListener('start', this.cancel);
    this.controls = c;
  }

  private readonly cancel = (): void => {
    this.tween.active = false;
  };

  resize(width: number, height: number, insets: ViewInsets): void {
    const aspect = width / Math.max(1, height);
    const c = this.camera;
    c.top = HALF_HEIGHT_2D;
    c.bottom = -HALF_HEIGHT_2D;
    c.left = -HALF_HEIGHT_2D * aspect;
    c.right = HALF_HEIGHT_2D * aspect;
    applyInsets(c, width, height, insets);
  }

  reset(animate: boolean): void {
    if (!animate || this.options.reducedMotion()) {
      this.apply(0, 0, 1);
      return;
    }
    this.fromPos.copy(this.camera.position);
    this.fromZoom = this.camera.zoom;
    this.tween.begin();
    this.options.onChange();
  }

  update(now: number): boolean {
    if (this.tween.active) {
      const e = this.tween.progress(now);
      const k = 1 - e;
      // Zoom interpolates geometrically so the motion feels uniform.
      const zoom = Math.exp(Math.log(this.fromZoom) * k);
      this.apply(this.fromPos.x * k, this.fromPos.y * k, zoom);
      return true;
    }
    return this.controls.update();
  }

  private apply(x: number, y: number, zoom: number): void {
    this.camera.position.set(x, y, 10);
    this.controls.target.set(x, y, 0);
    this.camera.zoom = zoom;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  dispose(): void {
    this.controls.removeEventListener('change', this.options.onChange);
    this.controls.removeEventListener('start', this.cancel);
    this.controls.dispose();
  }
}

/** Home view: z-up, x toward the viewer on the left, y to the right (right-handed). */
const HOME_TARGET_3D = new Vector3(0.35, 0.35, 0.3);
const HOME_RADIUS = 7.8;
const HOME_AZIMUTH = (30 * Math.PI) / 180;
const HOME_ELEVATION = (22 * Math.PI) / 180;

/** Spherical coordinates of a camera offset about a z-up target. */
interface Orbit {
  radius: number;
  azimuth: number;
  elevation: number;
}

function orbitOf(offset: Vector3, out: Orbit): Orbit {
  out.radius = Math.max(1e-6, offset.length());
  out.azimuth = Math.atan2(offset.y, offset.x);
  out.elevation = Math.asin(Math.max(-1, Math.min(1, offset.z / out.radius)));
  return out;
}

function offsetOf(o: Orbit, out: Vector3): Vector3 {
  const c = Math.cos(o.elevation);
  return out.set(
    o.radius * c * Math.cos(o.azimuth),
    o.radius * c * Math.sin(o.azimuth),
    o.radius * Math.sin(o.elevation),
  );
}

const HOME_ORBIT: Orbit = { radius: HOME_RADIUS, azimuth: HOME_AZIMUTH, elevation: HOME_ELEVATION };
const _offset = new Vector3();
const _orbit: Orbit = { radius: 1, azimuth: 0, elevation: 0 };

export class CameraRig3D implements CameraRig {
  readonly camera = new PerspectiveCamera(36, 1, 0.05, 500);
  readonly controls: OrbitControls;
  private readonly tween = new Tween();
  private readonly fromOrbit: Orbit = { radius: 1, azimuth: 0, elevation: 0 };
  private readonly fromTarget = new Vector3();

  constructor(
    dom: HTMLElement,
    private readonly options: RigOptions,
  ) {
    this.camera.up.set(0, 0, 1);
    this.camera.position.copy(offsetOf(HOME_ORBIT, _offset)).add(HOME_TARGET_3D);
    this.camera.lookAt(HOME_TARGET_3D);
    const c = new OrbitControls(this.camera, dom);
    c.target.copy(HOME_TARGET_3D);
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.rotateSpeed = 0.8;
    c.minDistance = 2;
    c.maxDistance = 60;
    c.screenSpacePanning = true;
    c.addEventListener('change', options.onChange);
    c.addEventListener('start', this.cancel);
    c.update();
    this.controls = c;
  }

  private readonly cancel = (): void => {
    this.tween.active = false;
  };

  resize(width: number, height: number, insets: ViewInsets): void {
    this.camera.aspect = width / Math.max(1, height);
    applyInsets(this.camera, width, height, insets);
  }

  reset(animate: boolean): void {
    // Flush any damping momentum so it cannot fight the tween.
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = true;
    this.fromTarget.copy(this.controls.target);
    orbitOf(_offset.subVectors(this.camera.position, this.controls.target), this.fromOrbit);
    if (!animate || this.options.reducedMotion()) {
      this.apply(1);
      return;
    }
    this.tween.begin();
    this.options.onChange();
  }

  update(now: number): boolean {
    if (this.tween.active) {
      this.apply(this.tween.progress(now));
      return true;
    }
    return this.controls.update();
  }

  /**
   * Place the camera a fraction `e` of the way from the reset's start view to the home view,
   * moving along the orbit (shortest azimuth, geometric radius) rather than through the scene.
   */
  private apply(e: number): void {
    const f = this.fromOrbit;
    let dAz = HOME_ORBIT.azimuth - f.azimuth;
    dAz -= 2 * Math.PI * Math.round(dAz / (2 * Math.PI));
    _orbit.azimuth = f.azimuth + dAz * e;
    _orbit.elevation = f.elevation + (HOME_ORBIT.elevation - f.elevation) * e;
    _orbit.radius = f.radius * Math.pow(HOME_ORBIT.radius / f.radius, e);
    this.controls.target.lerpVectors(this.fromTarget, HOME_TARGET_3D, e);
    this.camera.position.copy(offsetOf(_orbit, _offset)).add(this.controls.target);
    this.controls.update();
  }

  dispose(): void {
    this.controls.removeEventListener('change', this.options.onChange);
    this.controls.removeEventListener('start', this.cancel);
    this.controls.dispose();
  }
}
