import { tolFor } from '../tolerance';
import { matrix, type Matrix, type Vec } from './matrix';

/**
 * LU factorisation with partial pivoting: P·A = L·U.
 *
 * `lu` packs both factors. The strictly lower part holds L (its unit diagonal is implied) and
 * the upper part, diagonal included, holds U.
 */
export interface LUDecomposition {
  readonly lu: Matrix;
  /** Row permutation: row i of P·A is row perm[i] of A. */
  readonly perm: Int32Array;
  /** Sign of the permutation, so det A = sign · Π U_ii. */
  readonly sign: 1 | -1;
}

/**
 * Gaussian elimination with partial pivoting: the largest |entry| in the column becomes the
 * pivot, so every multiplier has |l| ≤ 1. Square n×n only. It never throws on singular input:
 * a column with no non-zero candidate keeps U_kk = 0 and elimination moves on.
 */
export function lu(m: Matrix): LUDecomposition {
  if (m.rows !== m.cols) throw new RangeError(`lu: non-square ${m.rows}×${m.cols} matrix`);
  const n = m.rows;
  const a = m.data.slice();
  const perm = new Int32Array(n);
  for (let i = 0; i < n; i++) perm[i] = i;
  let sign: 1 | -1 = 1;
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(a[i * n + k]) > Math.abs(a[p * n + k])) p = i;
    if (p !== k) {
      swapRows(a, n, p, k);
      const t = perm[p];
      perm[p] = perm[k];
      perm[k] = t;
      sign = sign === 1 ? -1 : 1;
    }
    const pivot = a[k * n + k];
    if (pivot === 0) continue;
    for (let i = k + 1; i < n; i++) {
      const l = a[i * n + k] / pivot;
      a[i * n + k] = l;
      for (let j = k + 1; j < n; j++) a[i * n + j] -= l * a[k * n + j];
    }
  }
  return { lu: { rows: n, cols: n, data: a }, perm, sign };
}

function swapRows(a: Float64Array, n: number, i: number, j: number): void {
  for (let c = 0; c < n; c++) {
    const t = a[i * n + c];
    a[i * n + c] = a[j * n + c];
    a[j * n + c] = t;
  }
}

/**
 * True iff some pivot has |U_kk| ≤ tol. Partial-pivoted LU and the RREF in rref.ts pick the same
 * pivots, so with the same tolerance this agrees with `rank(m) < n`.
 */
export function isSingularLU(f: LUDecomposition, tol: number): boolean {
  const n = f.lu.rows;
  for (let k = 0; k < n; k++) if (Math.abs(f.lu.data[k * n + k]) <= tol) return true;
  return false;
}

/**
 * det A = sign(P) · Π U_ii. The result is never snapped to zero: callers decide singularity
 * through the rank and its tolerance.
 */
export function det(m: Matrix): number {
  const f = lu(m);
  const n = m.rows;
  let d: number = f.sign;
  for (let k = 0; k < n; k++) d *= f.lu.data[k * n + k];
  return d;
}

/**
 * Solve L·U·x = P·b by forward and then back substitution, for a matrix that is already
 * factored. Writes into `out` when given.
 */
export function luSolve(f: LUDecomposition, b: ArrayLike<number>, out?: Vec): Vec {
  const n = f.lu.rows;
  if (b.length !== n) throw new RangeError(`luSolve: expected a vector of length ${n}`);
  const a = f.lu.data;
  const x = out ?? new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[f.perm[i]];
    for (let j = 0; j < i; j++) s -= a[i * n + j] * x[j];
    x[i] = s;
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i];
    for (let j = i + 1; j < n; j++) s -= a[i * n + j] * x[j];
    x[i] = s / a[i * n + i];
  }
  return x;
}

/** The x with A·x = b. Throws a RangeError if A is singular under tolFor(A). */
export function solve(m: Matrix, b: ArrayLike<number>): Vec {
  const f = lu(m);
  if (isSingularLU(f, tolFor(m))) throw new RangeError('solve: matrix is singular');
  return luSolve(f, b);
}

/**
 * A⁻¹, solved column by column from a single LU factorisation. Throws a RangeError if A is
 * singular under the relative tolerance tolFor(A), i.e. exactly when analyze() reports
 * rank < n.
 */
export function inverse(m: Matrix): Matrix {
  const f = lu(m);
  if (isSingularLU(f, tolFor(m))) throw new RangeError('inverse: matrix is singular');
  const n = m.rows;
  const inv = matrix(n, n);
  const e = new Float64Array(n);
  const x = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    e.fill(0);
    e[j] = 1;
    luSolve(f, e, x);
    for (let i = 0; i < n; i++) inv.data[i * n + j] = x[i];
  }
  return inv;
}
