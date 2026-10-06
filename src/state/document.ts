/**
 * FROZEN CONTRACT — the serializable scene document.
 *
 * Everything the user can configure lives here, as plain JSON (no Float64Arrays, no class
 * instances), so it can be persisted, shared via URL, undone, and migrated between versions.
 */
import type { InterpolationMode } from '../core/linalg/interpolate';
import { fromRows, identity, type Matrix, type Shape, toRows } from '../core/linalg/matrix';
import { mul } from '../core/linalg/ops';

export const DOCUMENT_VERSION = 1;

/** One linear map in the pipeline. `rows` is row-major, rows.length × rows[0].length. */
export interface TransformNode {
  readonly id: string;
  label: string;
  rows: number[][];
}

interface SceneObjectBase {
  readonly id: string;
  label?: string;
  visible: boolean;
  /** Key into the scene palette's object colours (see theme/palette.ts). */
  colorKey?: string;
}

/** A vector in the DOMAIN (length = cols of the effective map); its image is drawn too. */
export interface VectorObject extends SceneObjectBase {
  kind: 'vector';
  coords: number[];
}

/**
 * Discriminated union of drawable objects. Extend by adding a new member here, a renderer in
 * engine/objects/, and (optionally) an editor in ui/. See docs/ARCHITECTURE.md.
 */
export type SceneObject = VectorObject;
export type SceneObjectKind = SceneObject['kind'];

export interface ViewSettings {
  /** Layer visibility by layer id (see state/layers.ts). Missing id → layer's default. */
  layers: Record<string, boolean>;
  interpolation: InterpolationMode;
}

export interface SceneDocument {
  version: typeof DOCUMENT_VERSION;
  /**
   * The pipeline. The effective map is T_k ⋯ T_2 T_1 (T_1 = transforms[0] is applied first).
   * v1 UI always has exactly one node.
   */
  transforms: TransformNode[];
  objects: SceneObject[];
  view: ViewSettings;
}

/** Ambient dimension in which a shape is drawn: max(rows, cols), i.e. 2 or 3 in v1. */
export function ambientDim(shape: Shape): 2 | 3 {
  const d = Math.max(shape.rows, shape.cols);
  if (d !== 2 && d !== 3) throw new RangeError(`Unsupported ambient dimension ${d}`);
  return d;
}

export function documentShape(doc: SceneDocument): Shape {
  const first = doc.transforms[0];
  const last = doc.transforms[doc.transforms.length - 1];
  return { rows: last.rows.length, cols: first.rows[0].length };
}

/** Product T_k ⋯ T_1 as a Matrix. */
export function effectiveMatrix(doc: SceneDocument): Matrix {
  let acc: Matrix | null = null;
  for (const t of doc.transforms) {
    const m = fromRows(t.rows);
    acc = acc ? mul(m, acc) : m;
  }
  if (!acc) throw new Error('effectiveMatrix: empty pipeline');
  return acc;
}

let idCounter = 0;
/** Short unique id, stable within a session. */
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function defaultDocument(n: 2 | 3 = 2): SceneDocument {
  return {
    version: DOCUMENT_VERSION,
    transforms: [{ id: newId('t'), label: 'A', rows: toRows(identity(n)) }],
    objects: [],
    view: { layers: {}, interpolation: 'linear' },
  };
}
