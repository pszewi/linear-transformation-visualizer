/**
 * FROZEN CONTRACT — the types in this file are shared by core/, engine/ and ui/.
 * Changing a type here requires the head agent's approval.
 */
import { eigen as eigenOf, EIGEN_MAX_N } from './linalg/eigen';
import { det as detOf } from './linalg/lu';
import type { Matrix, Shape, Vec } from './linalg/matrix';
import { isSquare } from './linalg/matrix';
import { trace as traceOf } from './linalg/ops';
import { columnSpace, nullspace, rref } from './linalg/rref';
import { tolFor } from './tolerance';

export interface Complex {
  readonly re: number;
  readonly im: number;
}

/** One distinct eigenvalue together with its eigenspace. */
export interface EigenSpace {
  readonly value: Complex;
  /** Multiplicity as a root of the characteristic polynomial. */
  readonly algebraicMultiplicity: number;
  /** dim ker(A − λI). Always 1 ≤ geometric ≤ algebraic for real λ; 0 for non-real λ (not computed). */
  readonly geometricMultiplicity: number;
  /**
   * Orthonormal basis of the real eigenspace ker(A − λI), each of length n.
   * Empty for non-real eigenvalues.
   */
  readonly basis: readonly Vec[];
}

export interface EigenResult {
  /**
   * All n eigenvalues, repeated by algebraic multiplicity.
   * Order: real eigenvalues first, descending; then complex pairs by descending real part,
   * with the +im member before its conjugate.
   */
  readonly values: readonly Complex[];
  /** One entry per DISTINCT eigenvalue, in the same order as first appearance in `values`. */
  readonly spaces: readonly EigenSpace[];
  /** True iff some real eigenvalue has geometric < algebraic multiplicity. */
  readonly defective: boolean;
}

export type Orientation = 'preserving' | 'reversing' | 'degenerate';

export interface Analysis {
  readonly shape: Shape;
  readonly square: boolean;
  /** Numerical rank (relative tolerance, see core/tolerance.ts). */
  readonly rank: number;
  /** dim ker A = cols − rank (rank–nullity). */
  readonly nullity: number;
  /** Orthonormal basis of ker A ⊂ R^cols. */
  readonly kernelBasis: readonly Vec[];
  /** Orthonormal basis of im A ⊂ R^rows. */
  readonly imageBasis: readonly Vec[];
  /** Square-only fields below are undefined for non-square matrices. */
  readonly trace?: number;
  readonly det?: number;
  readonly invertible?: boolean;
  readonly orientation?: Orientation;
  readonly eigen?: EigenResult;
}

/**
 * Full analysis of `m`. Pure; cheap for n ≤ 3 (called once per matrix change, and once per
 * animation frame by the engine).
 *
 * For any m×n: the numerical rank comes from RREF with partial pivoting under tolFor(m).
 * Orthonormal kernel and image bases come from the same tolerance, so
 * kernelBasis.length = nullity = cols − rank and imageBasis.length = rank.
 * Square matrices also get trace, det (LU), invertible (rank === n, which agrees with
 * `inverse` not throwing), orientation (sign of det, 'degenerate' when not invertible) and,
 * for n ≤ 3, eigen data. `eigen` stays undefined for n > 3.
 */
export function analyze(m: Matrix): Analysis {
  const square = isSquare(m);
  const shape = { rows: m.rows, cols: m.cols };
  const tol = tolFor(m);
  const rank = rref(m, tol).pivots.length;
  const base = {
    shape,
    square,
    rank,
    nullity: m.cols - rank,
    kernelBasis: nullspace(m, tol),
    imageBasis: columnSpace(m, tol),
  };
  if (!square) return base;
  const det = detOf(m);
  const invertible = rank === m.rows;
  return {
    ...base,
    trace: traceOf(m),
    det,
    invertible,
    orientation: orientationOf(invertible, det),
    eigen: m.rows <= EIGEN_MAX_N ? eigenOf(m) : undefined,
  };
}

function orientationOf(invertible: boolean, det: number): Orientation {
  if (!invertible) return 'degenerate';
  return det > 0 ? 'preserving' : 'reversing';
}
