import type { Matrix } from './linalg/matrix';

/**
 * The single source of numerical tolerances. Do not scatter magic epsilons through the code.
 *
 * Tolerances are RELATIVE to the scale of the matrix: tol(A) = REL_TOL · max(1, ‖A‖∞),
 * where ‖A‖∞ is the max absolute row sum.
 */
export const REL_TOL = 1e-9;

/** Max absolute row sum ‖A‖∞. */
export function normInf(m: Matrix): number {
  let best = 0;
  for (let i = 0; i < m.rows; i++) {
    let s = 0;
    for (let j = 0; j < m.cols; j++) s += Math.abs(m.data[i * m.cols + j]);
    if (s > best) best = s;
  }
  return best;
}

/** Absolute tolerance appropriate for decisions (rank, zero tests) about `m`. */
export function tolFor(m: Matrix): number {
  return REL_TOL * Math.max(1, normInf(m));
}

/**
 * Tolerance for clustering eigenvalues as "repeated". Repeated roots of a polynomial are
 * only determined to ~sqrt(machine eps) (for double roots) or ~cbrt (triple), so this is
 * deliberately much looser than tolFor.
 */
export function eigenClusterTolFor(m: Matrix): number {
  return 1e-6 * Math.max(1, normInf(m));
}

/**
 * Machine epsilon (2⁻⁵²). Used only as the convergence threshold of iterative kernels that
 * should run to full working precision (the Jacobi SVD), never for rank or zero decisions,
 * which use tolFor / eigenClusterTolFor.
 */
export const MACHINE_EPS = Number.EPSILON;
