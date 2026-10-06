/**
 * Dense real matrices, row-major, any shape m×n.
 *
 * A Matrix represents a linear map R^cols → R^rows (domain dim = cols, codomain dim = rows).
 * Entry (i, j) lives at data[i * cols + j].
 *
 * Convention: functions return new matrices and never mutate their inputs, EXCEPT functions
 * that take an explicit `out` argument, which write into `out` and return it (for hot paths
 * where allocation must be avoided).
 */
export interface Matrix {
  readonly rows: number;
  readonly cols: number;
  readonly data: Float64Array;
}

/** A vector is a plain dense array of numbers. */
export type Vec = Float64Array;

export interface Shape {
  readonly rows: number;
  readonly cols: number;
}

export function matrix(rows: number, cols: number, data?: ArrayLike<number>): Matrix {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
    throw new RangeError(`Invalid matrix shape ${rows}×${cols}`);
  }
  const d = new Float64Array(rows * cols);
  if (data) {
    if (data.length !== rows * cols) {
      throw new RangeError(`Expected ${rows * cols} entries, got ${data.length}`);
    }
    d.set(data);
  }
  return { rows, cols, data: d };
}

export function zeros(rows: number, cols: number): Matrix {
  return matrix(rows, cols);
}

export function identity(n: number): Matrix {
  const m = matrix(n, n);
  for (let i = 0; i < n; i++) m.data[i * n + i] = 1;
  return m;
}

/** Build from nested rows. All rows must have equal, non-zero length. */
export function fromRows(rows: readonly (readonly number[])[]): Matrix {
  const r = rows.length;
  const c = r > 0 ? rows[0].length : 0;
  if (r === 0 || c === 0) throw new RangeError('fromRows: empty matrix');
  const m = matrix(r, c);
  for (let i = 0; i < r; i++) {
    if (rows[i].length !== c) throw new RangeError('fromRows: ragged rows');
    for (let j = 0; j < c; j++) m.data[i * c + j] = rows[i][j];
  }
  return m;
}

export function toRows(m: Matrix): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < m.rows; i++) {
    out.push(Array.from(m.data.subarray(i * m.cols, (i + 1) * m.cols)));
  }
  return out;
}

export function get(m: Matrix, i: number, j: number): number {
  return m.data[i * m.cols + j];
}

export function shapeOf(m: Matrix): Shape {
  return { rows: m.rows, cols: m.cols };
}

export function sameShape(a: Shape, b: Shape): boolean {
  return a.rows === b.rows && a.cols === b.cols;
}

export function isSquare(m: Shape): boolean {
  return m.rows === m.cols;
}

export function clone(m: Matrix): Matrix {
  return { rows: m.rows, cols: m.cols, data: m.data.slice() };
}

/** Copy `src` into `out` (shapes must match). */
export function copyInto(out: Matrix, src: Matrix): Matrix {
  if (!sameShape(out, src)) throw new RangeError('copyInto: shape mismatch');
  out.data.set(src.data);
  return out;
}

/** Entry-wise equality within absolute tolerance `tol`. */
export function equals(a: Matrix, b: Matrix, tol = 0): boolean {
  if (!sameShape(a, b)) return false;
  for (let k = 0; k < a.data.length; k++) {
    if (Math.abs(a.data[k] - b.data[k]) > tol) return false;
  }
  return true;
}

export function vec(values: ArrayLike<number>): Vec {
  return Float64Array.from(values as ArrayLike<number>);
}
