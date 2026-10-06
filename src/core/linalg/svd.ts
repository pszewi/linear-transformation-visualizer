import { MACHINE_EPS } from '../tolerance';
import type { Matrix, Vec } from './matrix';

/** Singular values with their right singular vectors: m·v_i = σ_i·u_i, ‖v_i‖ = 1. */
export interface RightSingular {
  /** σ_1 ≥ σ_2 ≥ … ≥ σ_cols ≥ 0 (one per column, including zeros). */
  readonly values: Float64Array;
  /** Orthonormal right singular vectors in R^cols, vectors[i] belonging to values[i]. */
  readonly vectors: readonly Vec[];
}

/**
 * Hard cap on Jacobi sweeps. One-sided Jacobi converges quadratically, and a 3×3 matrix needs
 * about 4–6 sweeps. The cap only guards against an endless loop on NaN input.
 */
const MAX_SWEEPS = 60;

/**
 * One-sided (Hestenes) Jacobi SVD, for any m×n. Plane rotations V are applied to the columns of
 * W = A until all pairs of columns are orthogonal to working precision. Then σ_j = ‖W e_j‖ and
 * the columns of V are the right singular vectors. Small singular values come out with
 * absolute error ≈ ε·‖A‖₂, without the squaring that forming AᵀA would cause. That makes the
 * method suitable for "how far from singular is A − λI" decisions.
 */
export function rightSingular(m: Matrix): RightSingular {
  const { rows, cols } = m;
  const w = m.data.slice();
  const v = new Float64Array(cols * cols);
  for (let i = 0; i < cols; i++) v[i * cols + i] = 1;
  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    let rotated = false;
    for (let p = 0; p < cols - 1; p++) {
      for (let q = p + 1; q < cols; q++) {
        if (rotatePair(w, rows, cols, v, p, q)) rotated = true;
      }
    }
    if (!rotated) break;
  }
  const sigma = new Float64Array(cols);
  for (let j = 0; j < cols; j++) {
    let s = 0;
    for (let i = 0; i < rows; i++) s += w[i * cols + j] * w[i * cols + j];
    sigma[j] = Math.sqrt(s);
  }
  const order = Array.from(sigma.keys()).sort((a, b) => sigma[b] - sigma[a]);
  return {
    values: Float64Array.from(order, (j) => sigma[j]),
    vectors: order.map((j) => Float64Array.from({ length: cols }, (_, i) => v[i * cols + j])),
  };
}

/**
 * Rotate columns p, q of W (and of V) so that they become orthogonal. Returns false when they
 * already are, to machine precision: |⟨w_p, w_q⟩| ≤ ε·‖w_p‖·‖w_q‖.
 */
function rotatePair(
  w: Float64Array,
  rows: number,
  cols: number,
  v: Float64Array,
  p: number,
  q: number,
): boolean {
  let alpha = 0;
  let beta = 0;
  let gamma = 0;
  for (let i = 0; i < rows; i++) {
    const wp = w[i * cols + p];
    const wq = w[i * cols + q];
    alpha += wp * wp;
    beta += wq * wq;
    gamma += wp * wq;
  }
  if (gamma === 0 || Math.abs(gamma) <= MACHINE_EPS * Math.sqrt(alpha * beta)) return false;
  const zeta = (beta - alpha) / (2 * gamma);
  const t = (zeta >= 0 ? 1 : -1) / (Math.abs(zeta) + Math.hypot(1, zeta));
  const c = 1 / Math.hypot(1, t);
  const s = c * t;
  rotateColumns(w, rows, cols, p, q, c, s);
  rotateColumns(v, cols, cols, p, q, c, s);
  return true;
}

function rotateColumns(
  a: Float64Array,
  rows: number,
  cols: number,
  p: number,
  q: number,
  c: number,
  s: number,
): void {
  for (let i = 0; i < rows; i++) {
    const ap = a[i * cols + p];
    const aq = a[i * cols + q];
    a[i * cols + p] = c * ap - s * aq;
    a[i * cols + q] = s * ap + c * aq;
  }
}
