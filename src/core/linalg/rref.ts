import { tolFor } from '../tolerance';
import type { Matrix, Vec } from './matrix';
import { orthonormalize } from './orthonormalize';

/** Reduced row echelon form of a matrix, together with its pivot columns. */
export interface RrefResult {
  /** The RREF itself, with the same shape as the input. Rows at index ≥ pivots.length are zero. */
  readonly r: Matrix;
  /** Pivot column of row i, increasing. pivots.length is the numerical rank. */
  readonly pivots: readonly number[];
}

/**
 * Gauss–Jordan elimination with partial pivoting, for any m×n. In each column the largest
 * remaining |entry| becomes the pivot. If that entry is ≤ `tol`, the column counts as dependent
 * and its remaining entries are set to exactly 0. `tol` defaults to the relative tolerance
 * tolFor(m).
 */
export function rref(m: Matrix, tol = tolFor(m)): RrefResult {
  const { rows, cols } = m;
  const a = m.data.slice();
  const pivots: number[] = [];
  let row = 0;
  for (let col = 0; col < cols && row < rows; col++) {
    let p = row;
    for (let i = row + 1; i < rows; i++) {
      if (Math.abs(a[i * cols + col]) > Math.abs(a[p * cols + col])) p = i;
    }
    if (Math.abs(a[p * cols + col]) <= tol) {
      for (let i = row; i < rows; i++) a[i * cols + col] = 0;
      continue;
    }
    swapRows(a, cols, p, row);
    eliminate(a, rows, cols, row, col);
    pivots.push(col);
    row++;
  }
  a.fill(0, row * cols);
  return { r: { rows, cols, data: a }, pivots };
}

/** Normalise the pivot row and clear column `col` in every other row. */
function eliminate(a: Float64Array, rows: number, cols: number, row: number, col: number): void {
  const pivot = a[row * cols + col];
  for (let j = col; j < cols; j++) a[row * cols + j] /= pivot;
  a[row * cols + col] = 1;
  for (let i = 0; i < rows; i++) {
    if (i === row) continue;
    const f = a[i * cols + col];
    if (f === 0) continue;
    for (let j = col; j < cols; j++) a[i * cols + j] -= f * a[row * cols + j];
    a[i * cols + col] = 0;
  }
}

function swapRows(a: Float64Array, cols: number, i: number, j: number): void {
  if (i === j) return;
  for (let c = 0; c < cols; c++) {
    const t = a[i * cols + c];
    a[i * cols + c] = a[j * cols + c];
    a[j * cols + c] = t;
  }
}

/** Numerical rank: the number of RREF pivots under `tol` (default tolFor(m)). */
export function rank(m: Matrix, tol = tolFor(m)): number {
  return rref(m, tol).pivots.length;
}

/**
 * Orthonormal basis of ker m ⊂ R^cols, with cols − rank vectors. Each free column f of the
 * RREF gives the kernel vector x_f = 1, x_pivot(i) = −R[i][f], with its other free entries 0.
 * These vectors are independent by construction. They are then orthonormalised with modified
 * Gram–Schmidt.
 */
export function nullspace(m: Matrix, tol = tolFor(m)): Vec[] {
  const { r, pivots } = rref(m, tol);
  const isPivot = new Uint8Array(m.cols);
  for (const c of pivots) isPivot[c] = 1;
  const raw: Vec[] = [];
  for (let f = 0; f < m.cols; f++) {
    if (isPivot[f]) continue;
    const v = new Float64Array(m.cols);
    v[f] = 1;
    for (let i = 0; i < pivots.length; i++) v[pivots[i]] = -r.data[i * m.cols + f];
    raw.push(v);
  }
  return orthonormalize(raw);
}

/**
 * Orthonormal basis of im m ⊂ R^rows, with rank vectors. The pivot columns of the ORIGINAL
 * matrix span the image. They are orthonormalised with modified Gram–Schmidt.
 */
export function columnSpace(m: Matrix, tol = tolFor(m)): Vec[] {
  const { pivots } = rref(m, tol);
  const columns = pivots.map((c) => {
    const v = new Float64Array(m.rows);
    for (let i = 0; i < m.rows; i++) v[i] = m.data[i * m.cols + c];
    return v;
  });
  return orthonormalize(columns);
}
