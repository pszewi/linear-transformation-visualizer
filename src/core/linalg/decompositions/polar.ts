import { registerDecomposition, type Decomposition } from '../decompose';
import { clone, type Matrix } from '../matrix';
import { hasRotationPolar, polar } from '../polar';

/** Largest n for which the polar decomposition is offered as an animation. */
const POLAR_STEPS_MAX_N = 3;

/**
 * Polar decomposition as two animatable steps: A = R·S, so first stretch along the orthogonal
 * eigen-directions of S (symmetric positive definite), then rotate by R ∈ SO(n).
 * Applicable to square matrices with n ≤ 3 that are invertible with det > 0, so that R is a
 * proper rotation rather than a reflection.
 * The last cumulative step is an exact copy of A. R·S itself equals A only up to rounding.
 */
export const polarDecomposition: Decomposition = {
  id: 'polar',
  name: 'Polar (rotate · stretch)',
  applicable(m: Matrix): boolean {
    return hasRotationPolar(m, POLAR_STEPS_MAX_N);
  },
  steps(m: Matrix) {
    if (!hasRotationPolar(m, POLAR_STEPS_MAX_N))
      throw new RangeError('polar: needs square n ≤ 3 with det > 0');
    const { r, s } = polar(m);
    return [
      { label: 'Stretch (S)', latex: 'S', factor: s, cumulative: clone(s) },
      { label: 'Rotate (R)', latex: 'R', factor: r, cumulative: clone(m) },
    ];
  },
};

registerDecomposition(polarDecomposition);
