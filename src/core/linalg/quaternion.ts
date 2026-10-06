/**
 * Unit quaternions for 3D rotations, stored as [w, x, y, z] in a Float64Array(4).
 * Every function writes into an `out` argument so that per-frame code never allocates.
 */
import type { Matrix } from './matrix';

export type Quat = Float64Array;

/** A new identity quaternion [1, 0, 0, 0]. */
export function quat(): Quat {
  return Float64Array.of(1, 0, 0, 0);
}

/**
 * Unit quaternion of a 3×3 rotation matrix, by Shepperd's method. It divides by the largest of
 * 4w², 4x², 4y², 4z² (read off the trace and the diagonal), so the result stays accurate for
 * every rotation, including half-turns. The result is normalised.
 */
export function quatFromRotation(r: Matrix, out: Quat): Quat {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = r.data;
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = 2 * Math.sqrt(tr + 1);
    out.set([s / 4, (m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s]);
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    out.set([(m21 - m12) / s, s / 4, (m01 + m10) / s, (m02 + m20) / s]);
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    out.set([(m02 - m20) / s, (m01 + m10) / s, s / 4, (m12 + m21) / s]);
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    out.set([(m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, s / 4]);
  }
  const len = Math.hypot(out[0], out[1], out[2], out[3]);
  for (let i = 0; i < 4; i++) out[i] /= len;
  return out;
}

/** Hamilton product a·b (apply b first, then a). `out` may alias a or b. */
export function quatMul(a: Quat, b: Quat, out: Quat): Quat {
  // Indexed reads (not destructuring) keep this per-frame path free of iterator allocations.
  const aw = a[0];
  const ax = a[1];
  const ay = a[2];
  const az = a[3];
  const bw = b[0];
  const bx = b[1];
  const by = b[2];
  const bz = b[3];
  out[0] = aw * bw - ax * bx - ay * by - az * bz;
  out[1] = aw * bx + ax * bw + ay * bz - az * by;
  out[2] = aw * by - ax * bz + ay * bw + az * bx;
  out[3] = aw * bz + ax * by - ay * bx + az * bw;
  return out;
}

/** Conjugate (the inverse, for a unit quaternion). `out` may alias q. */
export function quatConj(q: Quat, out: Quat): Quat {
  out[0] = q[0];
  out[1] = -q[1];
  out[2] = -q[2];
  out[3] = -q[3];
  return out;
}

/** Write the 3×3 rotation matrix of the unit quaternion q into `out` (3×3). */
export function rotationFromQuat(q: Quat, out: Matrix): Matrix {
  const w = q[0];
  const x = q[1];
  const y = q[2];
  const z = q[3];
  const d = out.data;
  d[0] = 1 - 2 * (y * y + z * z);
  d[1] = 2 * (x * y - w * z);
  d[2] = 2 * (x * z + w * y);
  d[3] = 2 * (x * y + w * z);
  d[4] = 1 - 2 * (x * x + z * z);
  d[5] = 2 * (y * z - w * x);
  d[6] = 2 * (x * z - w * y);
  d[7] = 2 * (y * z + w * x);
  d[8] = 1 - 2 * (x * x + y * y);
  return out;
}
