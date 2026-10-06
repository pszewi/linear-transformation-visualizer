/**
 * Preset registry, keyed by matrix shape. Add a preset with `registerPreset` (e.g. from a
 * feature module); the Presets panel lists `presetsFor(store.shape)` in registration order.
 */
import { sameShape, type Shape } from '../core/linalg/matrix';

export interface Preset {
  readonly id: string;
  readonly name: string;
  readonly shape: Shape;
  /** Row-major entries, shape.rows × shape.cols. */
  readonly rows: readonly (readonly number[])[];
  /** One sentence on what the map does geometrically. */
  readonly description: string;
}

const registry = new Map<string, Preset>();

export function registerPreset(preset: Preset): void {
  if (registry.has(preset.id)) throw new Error(`Preset '${preset.id}' already registered`);
  const { rows, cols } = preset.shape;
  const ok =
    preset.rows.length === rows &&
    preset.rows.every((r) => r.length === cols && r.every((x) => Number.isFinite(x)));
  if (!ok) throw new RangeError(`Preset '${preset.id}' does not match shape ${rows}×${cols}`);
  registry.set(preset.id, preset);
}

export function getPreset(id: string): Preset | undefined {
  return registry.get(id);
}

export function presetsFor(shape: Shape): Preset[] {
  return [...registry.values()].filter((p) => sameShape(p.shape, shape));
}

function define(id: string, name: string, rows: number[][], description: string): void {
  registerPreset({
    id,
    name,
    rows,
    description,
    shape: { rows: rows.length, cols: rows[0].length },
  });
}

const c45 = Math.SQRT1_2;

// ── 2×2 ──
define('2d-identity', 'Identity', [[1, 0], [0, 1]], 'Leaves every vector where it is.'); // prettier-ignore
define('2d-scale-2', 'Scale ×2', [[2, 0], [0, 2]], 'Doubles every length; area grows ×4.'); // prettier-ignore
define('2d-rotate-90', 'Rotate 90°', [[0, -1], [1, 0]], 'Quarter turn counter-clockwise; eigenvalues ±i.'); // prettier-ignore
define('2d-rotate-45', 'Rotate 45°', [[c45, -c45], [c45, c45]], 'Eighth turn counter-clockwise; lengths and areas preserved.'); // prettier-ignore
define('2d-shear-x', 'Shear x', [[1, 1], [0, 1]], 'Slides points horizontally in proportion to y; defective (λ = 1 twice, one eigenvector).'); // prettier-ignore
define('2d-shear-y', 'Shear y', [[1, 0], [1, 1]], 'Slides points vertically in proportion to x.'); // prettier-ignore
define('2d-reflect-x', 'Reflect x-axis', [[1, 0], [0, -1]], 'Mirror across the x-axis; orientation reversed (det = −1).'); // prettier-ignore
define('2d-reflect-diag', 'Reflect y = x', [[0, 1], [1, 0]], 'Swaps the coordinates: mirror across the line y = x.'); // prettier-ignore
define('2d-project-x', 'Project onto x', [[1, 0], [0, 0]], 'Flattens the plane onto the x-axis; rank 1, kernel is the y-axis.'); // prettier-ignore
define('2d-singular', 'Singular rank 1', [[1, 2], [2, 4]], 'Columns are parallel, so the plane collapses onto a line.'); // prettier-ignore
define('2d-spiral', 'Spiral', [[1, -1], [1, 1]], 'Rotate 45° and scale by √2; complex eigenvalues 1 ± i, no real eigenvectors.'); // prettier-ignore

// ── 3×3 ──
define('3d-identity', 'Identity', [[1, 0, 0], [0, 1, 0], [0, 0, 1]], 'Leaves every vector where it is.'); // prettier-ignore
define('3d-scale-2', 'Scale ×2', [[2, 0, 0], [0, 2, 0], [0, 0, 2]], 'Doubles every length; volume grows ×8.'); // prettier-ignore
define('3d-rotate-z-90', 'Rotate z 90°', [[0, -1, 0], [1, 0, 0], [0, 0, 1]], 'Quarter turn about the z-axis; eigenvalues 1, ±i.'); // prettier-ignore
define('3d-cyclic', 'Cyclic permute', [[0, 0, 1], [1, 0, 0], [0, 1, 0]], 'e₁ → e₂ → e₃ → e₁: a 120° rotation about (1, 1, 1).'); // prettier-ignore
define('3d-shear-xy', 'Shear xy', [[1, 1, 0], [0, 1, 0], [0, 0, 1]], 'Slides points along x in proportion to y.'); // prettier-ignore
define('3d-reflect-xy', 'Reflect xy-plane', [[1, 0, 0], [0, 1, 0], [0, 0, -1]], 'Mirror across the xy-plane; orientation reversed.'); // prettier-ignore
define('3d-project-xy', 'Project onto xy', [[1, 0, 0], [0, 1, 0], [0, 0, 0]], 'Flattens space onto the xy-plane; rank 2, kernel is the z-axis.'); // prettier-ignore
define('3d-singular-rank-2', 'Singular rank 2', [[1, 2, 3], [4, 5, 6], [7, 8, 9]], 'Columns are coplanar, so space collapses onto a plane.'); // prettier-ignore
define('3d-rank-1', 'Rank 1', [[1, 2, 3], [2, 4, 6], [3, 6, 9]], 'Every vector lands on the line through (1, 2, 3).'); // prettier-ignore
define('3d-defective', 'Defective', [[2, 1, 0], [0, 2, 0], [0, 0, 2]], 'λ = 2 three times but only a 2-dimensional eigenspace.'); // prettier-ignore
