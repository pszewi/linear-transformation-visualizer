import { matrix, type Matrix, type Vec } from './matrix';

/** C = A·B. Requires A.cols === B.rows. Writes into `out` if given (must not alias A or B). */
export function mul(a: Matrix, b: Matrix, out?: Matrix): Matrix {
  if (a.cols !== b.rows) throw new RangeError(`mul: ${a.rows}×${a.cols} · ${b.rows}×${b.cols}`);
  const c = out ?? matrix(a.rows, b.cols);
  if (c.rows !== a.rows || c.cols !== b.cols) throw new RangeError('mul: bad out shape');
  if (c === a || c === b) throw new RangeError('mul: out must not alias an input');
  const n = a.cols;
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < b.cols; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += a.data[i * n + k] * b.data[k * b.cols + j];
      c.data[i * b.cols + j] = s;
    }
  }
  return c;
}

/** y = A·x. Requires x.length === A.cols. Writes into `out` if given. */
export function apply(a: Matrix, x: ArrayLike<number>, out?: Vec): Vec {
  if (x.length !== a.cols) throw new RangeError(`apply: ${a.rows}×${a.cols} · vec(${x.length})`);
  const y = out ?? new Float64Array(a.rows);
  for (let i = 0; i < a.rows; i++) {
    let s = 0;
    for (let j = 0; j < a.cols; j++) s += a.data[i * a.cols + j] * x[j];
    y[i] = s;
  }
  return y;
}

export function transpose(a: Matrix): Matrix {
  const t = matrix(a.cols, a.rows);
  for (let i = 0; i < a.rows; i++)
    for (let j = 0; j < a.cols; j++) t.data[j * a.rows + i] = a.data[i * a.cols + j];
  return t;
}

/** Entry-wise (1−t)·A + t·B. Writes into `out` if given (may alias A or B). */
export function lerp(a: Matrix, b: Matrix, t: number, out?: Matrix): Matrix {
  if (a.rows !== b.rows || a.cols !== b.cols) throw new RangeError('lerp: shape mismatch');
  const c = out ?? matrix(a.rows, a.cols);
  for (let k = 0; k < a.data.length; k++) c.data[k] = a.data[k] + (b.data[k] - a.data[k]) * t;
  return c;
}

export function add(a: Matrix, b: Matrix): Matrix {
  return addScaled(a, b, 1);
}

/** A + s·B */
export function addScaled(a: Matrix, b: Matrix, s: number): Matrix {
  if (a.rows !== b.rows || a.cols !== b.cols) throw new RangeError('addScaled: shape mismatch');
  const c = matrix(a.rows, a.cols);
  for (let k = 0; k < a.data.length; k++) c.data[k] = a.data[k] + s * b.data[k];
  return c;
}

export function scale(a: Matrix, s: number): Matrix {
  const c = matrix(a.rows, a.cols);
  for (let k = 0; k < a.data.length; k++) c.data[k] = s * a.data[k];
  return c;
}

/** A + s·I (A square). */
export function addScaledIdentity(a: Matrix, s: number): Matrix {
  if (a.rows !== a.cols) throw new RangeError('addScaledIdentity: non-square');
  const c = matrix(a.rows, a.cols, a.data);
  for (let i = 0; i < a.rows; i++) c.data[i * a.cols + i] += s;
  return c;
}

export function trace(a: Matrix): number {
  if (a.rows !== a.cols) throw new RangeError('trace: non-square');
  let s = 0;
  for (let i = 0; i < a.rows; i++) s += a.data[i * a.cols + i];
  return s;
}

export function dot(x: ArrayLike<number>, y: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * y[i];
  return s;
}

export function norm2(x: ArrayLike<number>): number {
  return Math.sqrt(dot(x, x));
}
