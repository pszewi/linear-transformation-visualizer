/**
 * FROZEN CONTRACT — public surface of the application store (implemented in store.svelte.ts).
 */
import type { Analysis } from '../core/analysis';
import type { InterpolationMode } from '../core/linalg/interpolate';
import type { Matrix, Shape } from '../core/linalg/matrix';
import type { SceneDocument, SceneObject } from './document';
import type { SceneEventListener } from './events';

/**
 * How an edit was produced — decides animation and undo history:
 *  - 'live':   intermediate value of a continuous gesture (slider drag, scrub). Applied instantly,
 *              no history entry.
 *  - 'end':    final value of a continuous gesture. Applied instantly, ONE history entry for the
 *              whole gesture.
 *  - 'commit': discrete edit (typed value, preset, keyboard step). Animated, one history entry.
 */
export type EditPhase = 'live' | 'end' | 'commit';

export interface SceneStore {
  /** Reactive (Svelte $state) document. Read freely in components; mutate only via actions. */
  readonly doc: SceneDocument;
  /** Derived: effective matrix of the pipeline. */
  readonly matrix: Matrix;
  /** Derived: analyze(matrix). */
  readonly analysis: Analysis;
  readonly shape: Shape;
  readonly dim: 2 | 3;

  /** Edit entry (i, j) of the ACTIVE transform node (v1: the only node). */
  setEntry(i: number, j: number, value: number, phase: EditPhase): void;
  /** Replace the active transform's matrix (same shape). Always a 'commit'. */
  setMatrix(rows: number[][]): void;
  /** Switch 2D/3D: resets the pipeline to the identity of that size, drops objects. Emits 'load'. */
  setDimension(n: 2 | 3): void;
  applyPreset(presetId: string): void;

  addVector(coords?: number[]): string;
  updateObject(
    id: string,
    patch: Partial<Omit<SceneObject, 'id' | 'kind'>>,
    phase: EditPhase,
  ): void;
  removeObject(id: string): void;

  setLayerVisible(layerId: string, visible: boolean): void;
  setInterpolation(mode: InterpolationMode): void;
  resetCamera(): void;

  readonly canUndo: boolean;
  readonly canRedo: boolean;
  undo(): void;
  redo(): void;

  /** Replace the whole document (share link, restore). Validates + migrates. Emits 'load'. */
  load(doc: unknown): void;
  /** Deep, plain-JSON copy of the current document. */
  snapshot(): SceneDocument;

  /** Engine protocol. Listener is called synchronously after each state change. */
  subscribe(listener: SceneEventListener): () => void;
}
