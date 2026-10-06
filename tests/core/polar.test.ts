import { describe, expect, it } from 'vitest';
import { getDecomposition, listDecompositions } from '../../src/core/linalg/decompose';
import '../../src/core/linalg/decompositions';
import { eigen } from '../../src/core/linalg/eigen';
import { getInterpolator, linearInterpolator } from '../../src/core/linalg/interpolate';
import { det } from '../../src/core/linalg/lu';
import { fromRows, identity, matrix, type Matrix } from '../../src/core/linalg/matrix';
import { apply, lerp, mul, norm2, transpose } from '../../src/core/linalg/ops';
import { polar } from '../../src/core/linalg/polar';
import { randomMatrix, randomRotation3, rotation2, rotation3, scaleOf } from './helpers';
import { mulberry32 } from './prng';

const polarInterp = getInterpolator('polar');
const T = Array.from({ length: 21 }, (_, i) => i / 20);

function maxAbsDiff(a: Matrix, b: Matrix): number {
  let d = 0;
  for (let k = 0; k < a.data.length; k++) d = Math.max(d, Math.abs(a.data[k] - b.data[k]));
  return d;
}

/** A random n×n matrix with det > 0 (flip one row if needed; retry if singular). */
function randomPositiveDet(rng: () => number, n: number): Matrix {
  for (;;) {
    const a = randomMatrix(rng, n, n);
    const d = det(a);
    if (Math.abs(d) < 1e-3) continue;
    if (d < 0) for (let j = 0; j < n; j++) a.data[j] = -a.data[j];
    return a;
  }
}

describe('polar decomposition', () => {
  it('A = R·S with R ∈ SO(n) and S symmetric positive definite (random, seeded)', () => {
    const rng = mulberry32(41);
    for (let k = 0; k < 200; k++) {
      const n = 2 + (k % 2);
      const a = randomPositiveDet(rng, n);
      const { r, s } = polar(a);
      expect(maxAbsDiff(mul(transpose(r), r), identity(n))).toBeLessThan(1e-13);
      expect(det(r)).toBeCloseTo(1, 12);
      expect(maxAbsDiff(s, transpose(s))).toBe(0);
      for (const z of eigen(s).values) {
        expect(z.im).toBe(0);
        expect(z.re).toBeGreaterThan(0);
      }
      expect(maxAbsDiff(mul(r, s), a)).toBeLessThan(1e-12 * scaleOf(a));
    }
  });

  it('det < 0 gives an orthogonal R with det −1 (a reflection)', () => {
    const { r } = polar(
      fromRows([
        [0, 2],
        [3, 0],
      ]),
    );
    expect(det(r)).toBeCloseTo(-1, 14);
  });

  it('handles ill-conditioned input', () => {
    const a = fromRows([
      [1, 1e6],
      [0, 1],
    ]);
    const { r, s } = polar(a);
    expect(maxAbsDiff(mul(transpose(r), r), identity(2))).toBeLessThan(1e-12);
    expect(maxAbsDiff(mul(r, s), a)).toBeLessThan(1e-9);
  });

  it('throws on singular or non-square input', () => {
    expect(() =>
      polar(
        fromRows([
          [1, 2],
          [2, 4],
        ]),
      ),
    ).toThrow(RangeError);
    expect(() => polar(matrix(2, 3))).toThrow(RangeError);
  });
});

describe('polar interpolator', () => {
  it('has exact endpoints (random det > 0 pairs, seeded)', () => {
    const rng = mulberry32(42);
    for (let k = 0; k < 100; k++) {
      const n = 2 + (k % 2);
      const a = randomPositiveDet(rng, n);
      const b = randomPositiveDet(rng, n);
      const at = polarInterp.prepare(a, b);
      const out = matrix(n, n);
      expect(maxAbsDiff(at(0, out), a)).toBeLessThanOrEqual(1e-12);
      expect(maxAbsDiff(at(1, out), b)).toBeLessThanOrEqual(1e-12);
      // The open path never degenerates: R(t) ∈ SO(n) and S(t) stays positive definite.
      for (const t of T) expect(det(at(t, out))).toBeGreaterThan(0);
      // Continuous at the endpoints (no jump from the exact-copy branches).
      expect(maxAbsDiff(at(1e-9, out), a)).toBeLessThan(1e-6 * scaleOf(a) * scaleOf(b));
      expect(maxAbsDiff(at(1 - 1e-9, out), b)).toBeLessThan(1e-6 * scaleOf(a) * scaleOf(b));
    }
  });

  it('I → Rot(90°) in 2D is a pure rotation: det = 1 and ‖M(t)e₁‖ = 1', () => {
    const at = polarInterp.prepare(identity(2), rotation2(Math.PI / 2));
    const out = matrix(2, 2);
    for (const t of T) {
      at(t, out);
      expect(det(out)).toBeCloseTo(1, 14);
      expect(norm2(apply(out, [1, 0]))).toBeCloseTo(1, 14);
    }
    expect(maxAbsDiff(at(0.5, out), rotation2(Math.PI / 4))).toBeLessThan(1e-14);
  });

  it('2D takes the shorter way round: 170° → −170° passes through 180°', () => {
    const deg = Math.PI / 180;
    const at = polarInterp.prepare(rotation2(170 * deg), rotation2(-170 * deg));
    const out = matrix(2, 2);
    expect(maxAbsDiff(at(0.5, out), rotation2(Math.PI))).toBeLessThan(1e-14);
  });

  it('3D: I → Rz(90°) and a rotation about (1,1,1) stay rotations', () => {
    for (const target of [rotation3([0, 0, 1], Math.PI / 2), rotation3([1, 1, 1], 2)]) {
      const at = polarInterp.prepare(identity(3), target);
      const out = matrix(3, 3);
      for (const t of T) {
        at(t, out);
        expect(det(out)).toBeCloseTo(1, 13);
        expect(norm2(apply(out, [1, 0, 0]))).toBeCloseTo(1, 13);
        expect(maxAbsDiff(mul(transpose(out), out), identity(3))).toBeLessThan(1e-13);
      }
    }
    const half = polarInterp.prepare(identity(3), rotation3([0, 0, 1], Math.PI / 2))(
      0.5,
      matrix(3, 3),
    );
    expect(maxAbsDiff(half, rotation3([0, 0, 1], Math.PI / 4))).toBeLessThan(1e-14);
  });

  it('3D slerp between random rotations has constant angular speed (geodesic)', () => {
    const rng = mulberry32(43);
    for (let k = 0; k < 50; k++) {
      const a = randomRotation3(rng);
      const b = randomRotation3(rng);
      const at = polarInterp.prepare(a, b);
      const angleBetween = (x: Matrix, y: Matrix) => {
        const c =
          (mul(transpose(x), y).data.reduce((s, v, i) => s + (i % 4 === 0 ? v : 0), 0) - 1) / 2;
        return Math.acos(Math.min(1, Math.max(-1, c)));
      };
      const total = angleBetween(a, b);
      expect(total).toBeLessThanOrEqual(Math.PI + 1e-12);
      const m = at(0.25, matrix(3, 3));
      expect(angleBetween(a, m)).toBeCloseTo(total / 4, 9);
    }
  });

  it('falls back to linear for det < 0, singular or non-square endpoints', () => {
    const reflect = fromRows([
      [1, 0],
      [0, -1],
    ]);
    const singular = fromRows([
      [1, 2],
      [2, 4],
    ]);
    const cases: [Matrix, Matrix][] = [
      [identity(2), reflect],
      [reflect, identity(2)],
      [identity(2), singular],
      [matrix(2, 3, [1, 0, 0, 0, 1, 0]), matrix(2, 3, [0, 1, 0, 1, 0, 1])],
      [identity(4), mul(identity(4), identity(4))],
    ];
    for (const [a, b] of cases) {
      const at = polarInterp.prepare(a, b);
      const out = matrix(a.rows, a.cols);
      for (const t of T) expect(maxAbsDiff(at(t, out), lerp(a, b, t))).toBe(0);
    }
  });

  it('writes into `out` and returns it', () => {
    const out = matrix(2, 2);
    expect(polarInterp.prepare(identity(2), rotation2(1))(0.3, out)).toBe(out);
    expect(linearInterpolator.prepare(identity(2), rotation2(1))(0.3, out)).toBe(out);
  });
});

describe("'polar' decomposition registration", () => {
  it('is registered by decompositions/index.ts', () => {
    expect(getDecomposition('polar')).toBeDefined();
    expect(listDecompositions().map((d) => d.id)).toContain('polar');
  });

  it('steps: stretch S, then rotate R; cumulative R·S = A', () => {
    const d = getDecomposition('polar');
    if (!d) throw new Error('missing');
    const a = fromRows([
      [2, 1],
      [-1, 1.5],
    ]);
    expect(d.applicable(a)).toBe(true);
    const [s1, s2] = d.steps(a);
    expect(maxAbsDiff(s1.cumulative, s1.factor)).toBe(0);
    expect(maxAbsDiff(mul(s2.factor, s1.cumulative), a)).toBeLessThan(1e-12);
    expect(maxAbsDiff(s2.cumulative, a)).toBe(0);
    expect(det(s2.factor)).toBeCloseTo(1, 13);
    expect(maxAbsDiff(s1.factor, transpose(s1.factor))).toBe(0);
  });

  it('is not applicable to det ≤ 0, non-square or n > 3', () => {
    const d = getDecomposition('polar');
    if (!d) throw new Error('missing');
    expect(
      d.applicable(
        fromRows([
          [0, 1],
          [1, 0],
        ]),
      ),
    ).toBe(false);
    expect(d.applicable(matrix(3, 3))).toBe(false);
    expect(d.applicable(matrix(2, 3, [1, 0, 0, 0, 1, 0]))).toBe(false);
    expect(d.applicable(identity(4))).toBe(false);
    expect(d.applicable(rotation3([1, 0, 0], 1))).toBe(true);
    expect(() => d.steps(identity(4))).toThrow(RangeError);
  });
});
