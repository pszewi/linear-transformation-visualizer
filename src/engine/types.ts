/**
 * FROZEN CONTRACT — engine-internal plugin interfaces (layers) and the public handle.
 */
import type * as THREE from 'three';
import type { Analysis } from '../core/analysis';
import type { Matrix, Shape } from '../core/linalg/matrix';
import type { SceneObject } from '../state/document';
import type { SceneEvent } from '../state/events';
import type { ScenePalette } from '../theme/palette';

export type Dim = 2 | 3;

/** What a layer gets once, at creation (per ambient dimension). */
export interface LayerContext {
  readonly dim: Dim;
  /** Parent for this layer's 3D objects. Remove nothing else from the scene. */
  readonly root: THREE.Group;
  readonly palette: ScenePalette;
  /** Drawing-buffer size in CSS px, kept current; needed by LineMaterial.resolution. */
  readonly resolution: THREE.Vector2;
  /** Ask for a render on the next frame (render-on-demand). */
  requestRender(): void;
}

/**
 * What a layer gets on every update. Objects passed here are owned by the engine and reused
 * between frames — do not retain references across calls, do not mutate.
 */
export interface FrameState {
  readonly dim: Dim;
  readonly shape: Shape;
  /** The CURRENT map (interpolated during animation). */
  readonly matrix: Matrix;
  /**
   * The same map embedded as a THREE.Matrix4 (zero-padded to 3×3, then to 4×4).
   * Layers that draw "the image of a fixed geometry" set object.matrix = this and
   * object.matrixAutoUpdate = false, instead of recomputing vertices (GPU does the work).
   */
  readonly matrix4: THREE.Matrix4;
  /** analyze(matrix), computed once per changed frame by the engine. */
  readonly analysis: Analysis;
  readonly objects: readonly SceneObject[];
  readonly matrixChanged: boolean;
  readonly objectsChanged: boolean;
}

export interface Layer {
  readonly id: string;
  /** Build all GPU resources here. Called once. */
  init(ctx: LayerContext): void;
  /** Called only on frames where something changed. Must not allocate per call in steady state. */
  update(frame: FrameState): void;
  setVisible(visible: boolean): void;
  /** Viewport resized (CSS px). Optional. */
  resize?(width: number, height: number): void;
  /** Free EVERY geometry/material/texture/DOM node this layer created. */
  dispose(): void;
}

export type LayerFactory = () => Layer;

/**
 * Screen-space margins (CSS px) covered by floating UI (sidebar, bottom sheet). The canvas stays
 * full-bleed, but the camera centres the scene in the uncovered rectangle.
 */
export interface ViewInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** Public handle used by App. The only engine export ui/ may import (via engine/index.ts). */
export interface EngineHandle {
  /** Attach the canvas to `container` and start the (on-demand) loop. */
  mount(container: HTMLElement): void;
  dispatch(event: SceneEvent): void;
  /** Re-centre the view in the area not covered by floating UI. Cheap; call on every change. */
  setViewInsets(insets: ViewInsets): void;
  dispose(): void;
}
