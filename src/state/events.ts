/**
 * FROZEN CONTRACT — the one-way message protocol from state → engine.
 *
 * The store emits these; App wires `store.subscribe(e => engine.dispatch(e))`.
 * The engine never reads the store and never imports Svelte.
 */
import type { Matrix } from '../core/linalg/matrix';
import type { SceneDocument, SceneObject, ViewSettings } from './document';
import type { Step } from '../core/linalg/decompose';

export type SceneEvent =
  /**
   * Full (re)load: first mount, shape change (2D↔3D), loading a share link.
   * Engine rebuilds layers for the new ambient dimension, swaps camera rig, snaps (no animation).
   */
  | { type: 'load'; doc: SceneDocument }
  /**
   * The effective matrix changed.
   * animate=false: live edits (slider drag, scrubbing) — apply immediately.
   * animate=true: discrete commits (typed value, preset, undo) — tween with the view's interpolator.
   */
  | { type: 'matrix'; matrix: Matrix; animate: boolean }
  | { type: 'objects'; objects: readonly SceneObject[] }
  | { type: 'view'; view: ViewSettings }
  | { type: 'resetCamera' }
  /** Future (sequences/decompositions): play identity → steps[0] → … → steps[k-1]. */
  | { type: 'playSteps'; steps: readonly Step[] };

export type SceneEventListener = (event: SceneEvent) => void;
