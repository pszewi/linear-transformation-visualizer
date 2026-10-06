/**
 * FROZEN CONTRACT — interpolation strategies used by the engine's Animator.
 */
import { clone, copyInto, matrix, sameShape, type Matrix } from './matrix';
import { lerp, mul } from './ops';
import { hasRotationPolar, polar } from './polar';
import { quat, quatConj, quatFromRotation, quatMul, rotationFromQuat } from './quaternion';

export type InterpolationMode = 'linear' | 'polar';

/**
 * An Interpolator turns a (from, to) pair into a path t ∈ [0,1] ↦ M(t) with M(0)=from, M(1)=to.
 * `prepare` may do expensive work once (e.g. a polar decomposition); the returned `at`
 * function is called every animation frame and MUST NOT allocate — it writes into `out`.
 */
export interface Interpolator {
  readonly mode: InterpolationMode;
  prepare(from: Matrix, to: Matrix): (t: number, out: Matrix) => Matrix;
}

/** Entry-wise lerp. Matches 3Blue1Brown semantics: every point moves on a straight line. */
export const linearInterpolator: Interpolator = {
  mode: 'linear',
  prepare(from, to) {
    return (t, out) => lerp(from, to, t, out);
  },
};

/** Largest n the polar interpolator handles (angle lerp in 2D, quaternion slerp in 3D). */
const POLAR_MAX_N = 3;

/**
 * Polar interpolation. Each endpoint (square, det > 0) has a unique polar decomposition
 * A = R·S with R ∈ SO(n) and S symmetric positive definite. Interpolate R along the geodesic
 * (angle lerp in 2D, quaternion slerp in 3D) and S entry-wise; M(t) = R(t)·S(t). A rotation
 * preset therefore animates as a rotation instead of shrinking through the origin.
 * Falls back to linear if either endpoint is non-square, singular, or has det < 0
 * (R would not be in SO(n)), and also when the shapes differ or n is 1 (where polar and linear
 * coincide) or greater than 3.
 *
 * The rotation takes the shorter way round. A half-turn has no shorter way and goes
 * counter-clockwise in 2D. M(0) and M(1) are exact copies of the endpoints, which are
 * snapshotted in `prepare`. All scratch buffers are allocated in `prepare`, so the returned
 * function does not allocate.
 */
export const polarInterpolator: Interpolator = {
  mode: 'polar',
  prepare(from, to) {
    if (!polarApplicable(from, to)) return linearInterpolator.prepare(from, to);
    const a = clone(from);
    const b = clone(to);
    const pa = polar(a);
    const pb = polar(b);
    const n = a.rows;
    const rotation = n === 2 ? rotationPath2(pa.r, pb.r) : rotationPath3(pa.r, pb.r);
    const r = matrix(n, n);
    const s = matrix(n, n);
    return (t, out) => {
      if (t === 0) return copyInto(out, a);
      if (t === 1) return copyInto(out, b);
      rotation(t, r);
      lerp(pa.s, pb.s, t, s);
      return mul(r, s, out);
    };
  },
};

function polarApplicable(from: Matrix, to: Matrix): boolean {
  return (
    sameShape(from, to) &&
    from.rows >= 2 &&
    hasRotationPolar(from, POLAR_MAX_N) &&
    hasRotationPolar(to, POLAR_MAX_N)
  );
}

/** Writes the rotation R(t) into `out`. */
type RotationPath = (t: number, out: Matrix) => void;

/** 2D: lerp the rotation angle, with the difference wrapped to (−π, π] (shortest path). */
function rotationPath2(r0: Matrix, r1: Matrix): RotationPath {
  const theta0 = Math.atan2(r0.data[2], r0.data[0]);
  let delta = Math.atan2(r1.data[2], r1.data[0]) - theta0;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  else if (delta <= -Math.PI) delta += 2 * Math.PI;
  return (t, out) => {
    const theta = theta0 + t * delta;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    out.data[0] = c;
    out.data[1] = -s;
    out.data[2] = s;
    out.data[3] = c;
  };
}

/**
 * 3D: quaternion slerp written as q(t) = q₀·(q₀⁻¹q₁)^t. The relative rotation q₀⁻¹q₁ =
 * (cos φ, sin φ·u) is taken with cos φ ≥ 0 (the shorter way round), so
 * (q₀⁻¹q₁)^t = (cos tφ, sin tφ·u). Taking φ = atan2(|v|, w) needs no small-angle threshold.
 */
function rotationPath3(r0: Matrix, r1: Matrix): RotationPath {
  const q0 = quatFromRotation(r0, quat());
  const rel = quatMul(quatConj(q0, quat()), quatFromRotation(r1, quat()), quat());
  if (rel[0] < 0) for (let i = 0; i < 4; i++) rel[i] = -rel[i];
  const sinPhi = Math.hypot(rel[1], rel[2], rel[3]);
  const phi = Math.atan2(sinPhi, rel[0]);
  const ux = sinPhi > 0 ? rel[1] / sinPhi : 0;
  const uy = sinPhi > 0 ? rel[2] / sinPhi : 0;
  const uz = sinPhi > 0 ? rel[3] / sinPhi : 0;
  const step = quat();
  const q = quat();
  return (t, out) => {
    const half = t * phi;
    const s = Math.sin(half);
    step[0] = Math.cos(half);
    step[1] = s * ux;
    step[2] = s * uy;
    step[3] = s * uz;
    rotationFromQuat(quatMul(q0, step, q), out);
  };
}

export function getInterpolator(mode: InterpolationMode): Interpolator {
  return mode === 'polar' ? polarInterpolator : linearInterpolator;
}
