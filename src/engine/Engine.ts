/**
 * The engine: one WebGLRenderer (+ CSS2D overlay) for the app's lifetime, a camera rig per
 * ambient dimension, and the layers from engine/layers/registry.ts.
 *
 * Render-on-demand: a frame is scheduled only when something is dirty, a tween/timeline is
 * running, or the camera is still moving (reset tween, OrbitControls damping). Idle = 0 renders.
 *
 * Per changed frame the engine computes the current matrix (Animator), its Matrix4 embedding and
 * analyze(current) ONCE, then calls layer.update() on the visible layers. Hidden layers are
 * marked stale and refreshed when shown.
 */
import {
  AmbientLight,
  DirectionalLight,
  Group,
  Matrix4,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { analyze, type Analysis } from '../core/analysis';
import { identity, matrix, type Matrix, sameShape, type Shape } from '../core/linalg/matrix';
import type { Step } from '../core/linalg/decompose';
import {
  ambientDim,
  documentShape,
  effectiveMatrix,
  type SceneDocument,
  type SceneObject,
  type ViewSettings,
} from '../state/document';
import type { SceneEvent } from '../state/events';
import { layerVisible } from '../state/layers';
import { scenePalette } from '../theme/palette';
import { Animator } from './Animator';
import { debugEnabled, type LtvDebug } from './debug';
import { embedMatrix4 } from './embed';
import { createLayers } from './layers/registry';
import { type CameraRig, CameraRig2D, CameraRig3D, NO_INSETS } from './rigs';
import type { Dim, EngineHandle, FrameState, Layer, ViewInsets } from './types';
import './labels.css';

export interface EngineOptions {
  /** Replaces core analyze() (dev playground fixtures, tests). */
  readonly analyze?: (m: Matrix) => Analysis;
}

/** playSteps timeline: tween per step, then a short hold. */
export const STEP_MS = 700;
export const STEP_HOLD_MS = 350;

type MutableFrame = { -readonly [K in keyof FrameState]: FrameState[K] };

interface LayerEntry {
  readonly layer: Layer;
  readonly root: Group;
  visible: boolean;
  /** Missed updates while hidden (or never updated): refresh fully when next visible. */
  stale: boolean;
}

function fallbackAnalysis(m: Matrix): Analysis {
  return {
    shape: { rows: m.rows, cols: m.cols },
    square: m.rows === m.cols,
    rank: 0,
    nullity: m.cols,
    kernelBasis: [],
    imageBasis: [],
  };
}

/** Pad/truncate `m` into rows×cols with zeros (timeline steps of a different shape). */
function fitShape(m: Matrix, rows: number, cols: number): Matrix {
  if (m.rows === rows && m.cols === cols) return m;
  const out = matrix(rows, cols);
  for (let i = 0; i < Math.min(rows, m.rows); i++) {
    for (let j = 0; j < Math.min(cols, m.cols); j++)
      out.data[i * cols + j] = m.data[i * m.cols + j];
  }
  return out;
}

/** "Identity" of any shape: ones on the main diagonal. */
function identityLike(rows: number, cols: number): Matrix {
  return fitShape(identity(Math.max(rows, cols)), rows, cols);
}

export class Engine implements EngineHandle {
  private readonly analyzeFn: (m: Matrix) => Analysis;
  private readonly reducedMotionQuery: MediaQueryList | null;

  // ── model (valid before mount) ────────────────────────────────────────────
  private dim: Dim = 2;
  private shape: Shape = { rows: 2, cols: 2 };
  private readonly animator: Animator;
  private objects: readonly SceneObject[] = [];
  private view: ViewSettings = { layers: {}, interpolation: 'linear' };

  // ── rendering (after mount) ───────────────────────────────────────────────
  private container: HTMLElement | null = null;
  private renderer: WebGLRenderer | null = null;
  private labelRenderer: CSS2DRenderer | null = null;
  private readonly scene = new Scene();
  /**
   * Lighting for the few lit materials (3D arrowheads): ambient + a headlight that follows the
   * camera. Ambient + direct = π, so a surface facing the camera shows its exact palette colour
   * and silhouettes darken to 55%. Lines and fills are unlit.
   */
  private readonly headlight = new DirectionalLight(0xffffff, 0.45 * Math.PI);
  private rig: CameraRig | null = null;
  private layers: LayerEntry[] = [];
  private layersDim: Dim | null = null;
  private readonly resolution = new Vector2(1, 1);
  private insets: ViewInsets = NO_INSETS;
  private sized = false;
  private contextLost = false;
  private resizeObserver: ResizeObserver | null = null;
  private dprQuery: MediaQueryList | null = null;
  private debug: LtvDebug | null = null;

  // ── frame state ───────────────────────────────────────────────────────────
  private readonly matrix4 = new Matrix4();
  private readonly frame: MutableFrame;
  private raf = 0;
  private needsRender = false;
  private matrixDirty = true;
  private objectsDirty = true;

  constructor(options: EngineOptions = {}) {
    this.analyzeFn = options.analyze ?? analyze;
    this.reducedMotionQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    this.scene.add(new AmbientLight(0xffffff, 0.55 * Math.PI), this.headlight);
    const initial = identity(2);
    this.animator = new Animator(initial, { reducedMotion: this.reducedMotion });
    this.frame = {
      dim: 2,
      shape: this.shape,
      matrix: this.animator.current,
      matrix4: this.matrix4,
      analysis: fallbackAnalysis(initial),
      objects: this.objects,
      matrixChanged: true,
      objectsChanged: true,
    };
  }

  private readonly reducedMotion = (): boolean => this.reducedMotionQuery?.matches ?? false;

  // ── public API ────────────────────────────────────────────────────────────

  mount(container: HTMLElement): void {
    if (this.container === container) return;
    if (this.container) this.unmountDom();
    this.container = container;

    if (!this.renderer) {
      const r = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.setClearColor(scenePalette.background, 1);
      const canvas = r.domElement;
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.addEventListener('webglcontextlost', this.onContextLost);
      canvas.addEventListener('webglcontextrestored', this.onContextRestored);
      this.renderer = r;
      const labels = new CSS2DRenderer();
      labels.domElement.className = 'ltv-label-layer';
      this.labelRenderer = labels;
    }
    const labelDom = this.labelRenderer?.domElement;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.append(this.renderer.domElement);
    if (labelDom) container.append(labelDom);

    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(container);
    this.watchPixelRatio();
    this.installDebug();
    this.ensureScene();
    this.onResize();
  }

  dispatch(event: SceneEvent): void {
    switch (event.type) {
      case 'load':
        this.load(event.doc);
        break;
      case 'matrix':
        this.setMatrix(event.matrix, event.animate);
        break;
      case 'objects':
        this.objects = event.objects;
        this.objectsDirty = true;
        this.schedule();
        break;
      case 'view':
        this.applyView(event.view);
        break;
      case 'resetCamera':
        this.rig?.reset(true);
        this.requestRender();
        break;
      case 'playSteps':
        this.playSteps(event.steps);
        break;
    }
  }

  setViewInsets(insets: ViewInsets): void {
    const a = this.insets;
    if (
      a.top === insets.top &&
      a.right === insets.right &&
      a.bottom === insets.bottom &&
      a.left === insets.left
    ) {
      return;
    }
    this.insets = { ...insets };
    if (!this.sized || !this.rig) return;
    this.rig.resize(this.resolution.x, this.resolution.y, this.insets);
    this.requestRender();
  }

  dispose(): void {
    this.unmountDom();
    this.disposeLayers();
    this.rig?.dispose();
    this.rig = null;
    if (this.renderer) {
      const canvas = this.renderer.domElement;
      canvas.removeEventListener('webglcontextlost', this.onContextLost);
      canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer = null;
    }
    this.labelRenderer = null;
  }

  /** Ask for a render on the next animation frame. */
  readonly requestRender = (): void => {
    this.needsRender = true;
    this.schedule();
  };

  // ── events ────────────────────────────────────────────────────────────────

  private load(doc: SceneDocument): void {
    let shape: Shape;
    let dim: Dim;
    let m: Matrix;
    try {
      shape = documentShape(doc);
      dim = ambientDim(shape);
      m = effectiveMatrix(doc);
    } catch (err) {
      console.error('engine: ignoring unloadable document', err);
      return;
    }
    this.shape = shape;
    this.dim = dim;
    this.animator.snap(m);
    this.objects = doc.objects;
    this.view = { layers: { ...doc.view.layers }, interpolation: doc.view.interpolation };
    this.matrixDirty = true;
    this.objectsDirty = true;
    if (this.renderer) {
      this.ensureScene();
      this.applyLayerVisibility();
    }
    this.schedule();
  }

  private setMatrix(m: Matrix, animate: boolean): void {
    if (!sameShape(m, this.shape)) {
      // A shape change normally arrives as 'load'; stay robust if it does not.
      let dim: Dim;
      try {
        dim = ambientDim(m);
      } catch (err) {
        console.error('engine: unsupported matrix shape', err);
        return;
      }
      this.shape = { rows: m.rows, cols: m.cols };
      this.dim = dim;
      this.animator.snap(m);
      if (this.renderer) this.ensureScene();
    } else if (animate) {
      this.animator.animateTo(m, this.view.interpolation, performance.now());
    } else {
      this.animator.snap(m);
    }
    this.matrixDirty = true;
    this.schedule();
  }

  private applyView(view: ViewSettings): void {
    this.view = { layers: { ...view.layers }, interpolation: view.interpolation };
    this.applyLayerVisibility();
  }

  private applyLayerVisibility(): void {
    for (const e of this.layers) {
      const v = layerVisible(this.view.layers, e.layer.id);
      if (v === e.visible) continue;
      e.visible = v;
      e.layer.setVisible(v);
      this.needsRender = true;
    }
    this.schedule();
  }

  private playSteps(steps: readonly Step[]): void {
    if (steps.length === 0) return;
    const { rows, cols } = this.shape;
    const targets = [identityLike(rows, cols)];
    for (const s of steps) targets.push(fitShape(s.cumulative, rows, cols));
    this.animator.play(targets, this.view.interpolation, performance.now(), STEP_MS, STEP_HOLD_MS);
    this.matrixDirty = true;
    this.schedule();
  }

  // ── scene management ──────────────────────────────────────────────────────

  /** Make the rig and layers match the current ambient dimension (mounted only). */
  private ensureScene(): void {
    const renderer = this.renderer;
    if (!renderer) return;
    if (!this.rig || this.layersDim !== this.dim) {
      this.rig?.dispose();
      const opts = { onChange: this.requestRender, reducedMotion: this.reducedMotion };
      this.rig =
        this.dim === 2
          ? new CameraRig2D(renderer.domElement, opts)
          : new CameraRig3D(renderer.domElement, opts);
      if (this.sized) this.rig.resize(this.resolution.x, this.resolution.y, this.insets);
    }
    if (this.layersDim === this.dim) return;
    this.disposeLayers();
    this.layersDim = this.dim;
    if (this.labelRenderer) this.labelRenderer.sortObjects = this.dim === 3;
    for (const layer of createLayers(this.dim)) {
      const root = new Group();
      root.name = `layer:${layer.id}`;
      this.scene.add(root);
      layer.init({
        dim: this.dim,
        root,
        palette: scenePalette,
        resolution: this.resolution,
        requestRender: this.requestRender,
      });
      const visible = layerVisible(this.view.layers, layer.id);
      layer.setVisible(visible);
      if (this.sized) layer.resize?.(this.resolution.x, this.resolution.y);
      this.layers.push({ layer, root, visible, stale: true });
    }
    this.needsRender = true;
  }

  private disposeLayers(): void {
    for (const e of this.layers) {
      e.layer.dispose();
      this.scene.remove(e.root);
    }
    this.layers = [];
    this.layersDim = null;
  }

  // ── loop ──────────────────────────────────────────────────────────────────

  private schedule(): void {
    if (this.raf !== 0 || !this.renderer || this.contextLost) return;
    this.raf = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    this.raf = 0;
    const renderer = this.renderer;
    const rig = this.rig;
    if (!renderer || !rig || !this.sized || this.contextLost) return;
    const t0 = performance.now();

    let matrixChanged = this.matrixDirty;
    if (this.animator.active && this.animator.step(now)) matrixChanged = true;
    const objectsChanged = this.objectsDirty;
    this.matrixDirty = false;
    this.objectsDirty = false;

    const moving = rig.update(now);
    const updated = this.updateLayers(matrixChanged, objectsChanged);

    if (updated || moving || this.needsRender) {
      this.needsRender = false;
      this.headlight.position.copy(rig.camera.position);
      renderer.render(this.scene, rig.camera);
      this.labelRenderer?.render(this.scene, rig.camera);
      if (this.debug) {
        this.debug.renders++;
        this.debug.lastFrameMs = performance.now() - t0;
      }
    }
    if (this.animator.active || moving) this.schedule();
  };

  /**
   * Returns true if any layer was updated. The frame always holds the latest matrix/analysis
   * (every matrix change sets matrixDirty), so a stale layer can be refreshed from it at any time.
   */
  private updateLayers(matrixChanged: boolean, objectsChanged: boolean): boolean {
    const f = this.frame;
    if (matrixChanged) {
      const m = this.animator.current;
      f.matrix = m;
      f.shape = this.shape;
      f.dim = this.dim;
      embedMatrix4(m, this.matrix4);
      f.analysis = this.safeAnalyze(m);
    }
    f.objects = this.objects;
    let any = false;
    for (const e of this.layers) {
      if (!e.visible) {
        if (matrixChanged || objectsChanged) e.stale = true;
        continue;
      }
      f.matrixChanged = matrixChanged || e.stale;
      f.objectsChanged = objectsChanged || e.stale;
      if (!f.matrixChanged && !f.objectsChanged) continue;
      e.layer.update(f);
      e.stale = false;
      any = true;
    }
    return any;
  }

  private analyzeFailed = false;

  private safeAnalyze(m: Matrix): Analysis {
    try {
      return this.analyzeFn(m);
    } catch (err) {
      if (!this.analyzeFailed) console.error('engine: analyze() failed', err);
      this.analyzeFailed = true;
      return fallbackAnalysis(m);
    }
  }

  // ── DOM plumbing ──────────────────────────────────────────────────────────

  private readonly onResize = (): void => {
    const c = this.container;
    const r = this.renderer;
    if (!c || !r) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (w === 0 || h === 0) return;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    if (pr !== r.getPixelRatio()) r.setPixelRatio(pr);
    r.setSize(w, h, false);
    this.labelRenderer?.setSize(w, h);
    this.resolution.set(w, h);
    this.sized = true;
    this.rig?.resize(w, h, this.insets);
    for (const e of this.layers) e.layer.resize?.(w, h);
    // Render synchronously: a resized canvas is cleared, and waiting a frame would flash.
    this.needsRender = true;
    if (this.raf !== 0) cancelAnimationFrame(this.raf);
    this.tick(performance.now());
  };

  private watchPixelRatio(): void {
    this.dprQuery?.removeEventListener('change', this.onPixelRatioChange);
    if (typeof window.matchMedia !== 'function') return;
    this.dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    this.dprQuery.addEventListener('change', this.onPixelRatioChange);
  }

  private readonly onPixelRatioChange = (): void => {
    this.watchPixelRatio();
    this.onResize();
  };

  private readonly onContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    if (this.raf !== 0) cancelAnimationFrame(this.raf);
    this.raf = 0;
  };

  private readonly onContextRestored = (): void => {
    this.contextLost = false;
    this.requestRender();
  };

  private unmountDom(): void {
    if (this.raf !== 0) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.dprQuery?.removeEventListener('change', this.onPixelRatioChange);
    this.dprQuery = null;
    this.renderer?.domElement.remove();
    this.labelRenderer?.domElement.remove();
    this.uninstallDebug();
    this.container = null;
    this.sized = false;
  }

  private installDebug(): void {
    if (!debugEnabled() || !this.renderer) return;
    const r = this.renderer;
    const dbg: LtvDebug = {
      renders: 0,
      lastFrameMs: 0,
      info: () => ({
        geometries: r.info.memory.geometries,
        textures: r.info.memory.textures,
        programs: r.info.programs?.length ?? 0,
        calls: r.info.render.calls,
      }),
    };
    this.debug = dbg;
    window.__LTV_DEBUG__ = dbg;
  }

  private uninstallDebug(): void {
    if (this.debug && window.__LTV_DEBUG__ === this.debug) delete window.__LTV_DEBUG__;
    this.debug = null;
  }
}
