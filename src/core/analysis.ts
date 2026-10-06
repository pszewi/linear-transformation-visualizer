/**
 * FROZEN CONTRACT — the types in this file are shared by core/, engine/ and ui/.
 * Changing a type here requires the head agent's approval.
 */
import type { Matrix, Shape, Vec } from './linalg/matrix';
import { isSquare } from './linalg/matrix';
import { trace as traceOf } from './linalg/ops';

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
 * STUB (head agent): det/trace for 2×2 and 3×3 only, rank guessed from det, no eigen data.
 * The math agent replaces the body with the real implementation.
 */
export function analyze(m: Matrix): Analysis {
  const square = isSquare(m);
  const shape = { rows: m.rows, cols: m.cols };
  if (!square) {
    return {
      shape,
      square,
      rank: Math.min(m.rows, m.cols),
      nullity: 0,
      kernelBasis: [],
      imageBasis: [],
    };
  }
  const d = m.data;
  const det =
    m.rows === 2
      ? d[0] * d[3] - d[1] * d[2]
      : m.rows === 3
        ? d[0] * (d[4] * d[8] - d[5] * d[7]) -
          d[1] * (d[3] * d[8] - d[5] * d[6]) +
          d[2] * (d[3] * d[7] - d[4] * d[6])
        : NaN;
  const invertible = Math.abs(det) > 1e-9;
  const rank = invertible ? m.rows : m.rows - 1;
  return {
    shape,
    square,
    rank,
    nullity: m.cols - rank,
    kernelBasis: [],
    imageBasis: [],
    trace: traceOf(m),
    det,
    invertible,
    orientation: !invertible ? 'degenerate' : det > 0 ? 'preserving' : 'reversing',
    eigen: { values: [], spaces: [], defective: false },
  };
}
