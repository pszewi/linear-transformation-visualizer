/**
 * Embedding of an m×n map (m, n ≤ 3) into a THREE.Matrix4 acting on the 3D ambient space.
 *
 * A goes in the top-left. For ambient axes k with max(rows, cols) ≤ k < 3 the diagonal entry
 * is 1, so in 2D the z axis passes through unchanged (used for depth layering). Every other
 * entry is 0 (domain vectors are zero-padded). The last row/column is homogeneous.
 */
import type { Matrix4 } from 'three';
import type { Matrix } from '../core/linalg/matrix';

export function embedMatrix4(m: Matrix, out: Matrix4): Matrix4 {
  const passFrom = Math.max(m.rows, m.cols);
  const e = out.elements; // column-major
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let v: number;
      if (i === 3 || j === 3) v = i === j ? 1 : 0;
      else if (i < m.rows && j < m.cols) v = m.data[i * m.cols + j];
      else v = i === j && i >= passFrom ? 1 : 0;
      e[j * 4 + i] = v;
    }
  }
  return out;
}

/**
 * Write A·v into `out` (length 3, zero-padded), padding/truncating the domain vector `v` to
 * A.cols. Never throws on a length mismatch (objects may lag a shape change by one event).
 */
export function applyPadded(m: Matrix, v: ArrayLike<number>, out: Float64Array): Float64Array {
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  const rows = Math.min(m.rows, 3);
  for (let i = 0; i < rows; i++) {
    let s = 0;
    for (let j = 0; j < m.cols; j++) {
      const x = j < v.length ? v[j] : 0;
      s += m.data[i * m.cols + j] * x;
    }
    out[i] = s;
  }
  return out;
}

/** Copy a domain vector into a length-3 buffer, keeping only its first `n` coordinates. */
export function padTo3(v: ArrayLike<number>, n: number, out: Float64Array): Float64Array {
  for (let i = 0; i < 3; i++) out[i] = i < n && i < v.length ? v[i] : 0;
  return out;
}

/** Column j of A as a 3-vector (zero-padded); zero if j ≥ cols. */
export function columnPadded(m: Matrix, j: number, out: Float64Array): Float64Array {
  for (let i = 0; i < 3; i++) out[i] = i < m.rows && j < m.cols ? m.data[i * m.cols + j] : 0;
  return out;
}
