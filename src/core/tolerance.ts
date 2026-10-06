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
 * Threshold κ for "B is numerically nilpotent", applied to the depressed-cubic coefficients
 * p = c₁(B) and q = −det(B) of B = (A − (tr/3)·I)/s, where s = max|B_ij| (see
 * linalg/eigen.ts). A has a triple eigenvalue exactly when B is nilpotent, i.e. p = q = 0, so the
 * computed |p|, |q| then hold rounding error only:
 *   - Data error. A stored entry of A is off by ≤ ½ε·max|a_ij| ≤ ½ε·(|shift| + s), so an entry
 *     of B is off by δ ≤ ½ε·(1 + |shift|/s). For a nilpotent B with |b_ij| ≤ 1, every partial
 *     derivative of p is ≤ 2 in size, and every cofactor (∂det/∂b_ij) is ≤ 2 as well. So one
 *     ulp per entry moves p by ≤ 12δ and q by ≤ 18δ, i.e. q by at most 9ε·(1 + |shift|/s).
 *   - Formation error. Evaluating p and det(B) at unit scale adds a few ε, which the "1 +"
 *     term covers.
 * NILPOTENT_SLACK = 32 allows about 3.5 ulps of error per entry from upstream arithmetic, at
 * worst-case alignment. That covers a matrix built from a couple of products, such as Q·J·Qᵀ.
 * In tests, rotated or similarity-transformed nilpotent parts reach at most ≈ 6.3 units, while
 * generic random matrices sit above 1e12 units.
 */
export const NILPOTENT_SLACK = 32;

/** κ = NILPOTENT_SLACK · ε · (1 + |shift|/s); see NILPOTENT_SLACK. */
export function nilpotentTol(shift: number, s: number): number {
  return NILPOTENT_SLACK * MACHINE_EPS * (1 + Math.abs(shift) / s);
}

/**
 * Machine epsilon (2⁻⁵²). Used only as the convergence threshold of iterative kernels that
 * should run to full working precision (the Jacobi SVD), never for rank or zero decisions,
 * which use tolFor / eigenClusterTolFor.
 */
export const MACHINE_EPS = Number.EPSILON;
