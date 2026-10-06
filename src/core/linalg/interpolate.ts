/**
 * FROZEN CONTRACT — interpolation strategies used by the engine's Animator.
 */
import type { Matrix } from './matrix';
import { lerp } from './ops';

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

/**
 * Polar interpolation. Each endpoint (square, det > 0) has a unique polar decomposition
 * A = R·S with R ∈ SO(n) and S symmetric positive definite. Interpolate R along the geodesic
 * (angle lerp in 2D, quaternion slerp in 3D) and S entry-wise; M(t) = R(t)·S(t). A rotation
 * preset therefore animates as a rotation instead of shrinking through the origin.
 * Falls back to linear if either endpoint is non-square, singular, or has det < 0
 * (R would not be in SO(n)).
 *
 * STUB (head agent): currently identical to linear. Math agent implements.
 */
export const polarInterpolator: Interpolator = {
  mode: 'polar',
  prepare: linearInterpolator.prepare,
};

export function getInterpolator(mode: InterpolationMode): Interpolator {
  return mode === 'polar' ? polarInterpolator : linearInterpolator;
}
